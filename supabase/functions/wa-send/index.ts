// =============================================
// Edge Function: wa-send
// =============================================
// Envia o template de aprovação por WhatsApp para o cliente da tarefa.
// Chamada pelo ERP (autenticada pelo JWT do usuário) via:
//   supabaseClient.functions.invoke('wa-send', { body: { task_id } })

import {
  adminClient,
  CORS,
  ENV,
  json,
  normalizePhone,
  sendApprovalTemplate,
} from "../_shared/wa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Exige usuário autenticado do ERP (Authorization: Bearer <jwt>)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  // Confere que o JWT é válido (usa anon key + o token recebido)
  const authed = adminClient();
  const { data: userData } = await authed.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (!userData?.user) return json({ error: "unauthorized" }, 401);

  let body: { task_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const taskId = body.task_id;
  if (!taskId) return json({ error: "task_id_required" }, 400);

  const db = adminClient();

  // Carrega tarefa + cliente
  const { data: task, error: taskErr } = await db
    .from("tasks")
    .select("id, title, text, art_url, client_id, clients(id, name, phone)")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) return json({ error: "task_not_found" }, 404);

  const client = (task as Record<string, any>).clients;
  const phone = normalizePhone(client?.phone ?? "");
  const artUrl = (task as Record<string, any>).art_url ?? "";

  if (!phone) return json({ error: "client_phone_missing" }, 422);
  if (!artUrl) return json({ error: "art_url_missing" }, 422);

  // Registra o dispatch antes do envio (status 'sent')
  const { data: dispatch, error: dispErr } = await db
    .from("whatsapp_dispatches")
    .insert({
      task_id: taskId,
      client_id: client?.id ?? null,
      phone,
      status: "sent",
    })
    .select()
    .single();

  if (dispErr || !dispatch) {
    return json({ error: "dispatch_insert_failed", detail: dispErr?.message }, 500);
  }

  // Envia o template
  try {
    const wamId = await sendApprovalTemplate({
      to: phone,
      artUrl,
      clientName: client?.name ?? "Cliente",
      title: (task as Record<string, any>).title ?? "Novo conteúdo",
      caption: (task as Record<string, any>).text ?? "",
    });

    await db
      .from("whatsapp_dispatches")
      .update({ wam_id: wamId })
      .eq("id", dispatch.id);

    // Marca a tarefa como enviada ao cliente (mesmo status do fluxo web)
    await db.from("tasks").update({ status: "Enviado ao Cliente" }).eq("id", taskId);

    return json({ ok: true, dispatch_id: dispatch.id, wam_id: wamId, to: phone });
  } catch (e) {
    await db
      .from("whatsapp_dispatches")
      .update({ status: "failed", feedback: String(e) })
      .eq("id", dispatch.id);
    return json({ error: "whatsapp_send_failed", detail: String(e) }, 502);
  }
});
