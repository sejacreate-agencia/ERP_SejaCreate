// =============================================
// Edge Function: wa-webhook (público)
// =============================================
// Recebe os eventos do WhatsApp Cloud API (Meta):
//  - GET : verificação do webhook (hub.challenge)
//  - POST: toque nos botões (Aprovar / Solicitar Ajuste) e mensagens de texto
//
// Regras de mapeamento:
//  - Toque em botão de template chega como type "button" com context.id =
//    id da mensagem template enviada (wam_id) -> acha o dispatch.
//  - Texto livre chega como type "text"; se o último dispatch daquele telefone
//    estiver 'awaiting_reason', tratamos como o motivo do ajuste.

import { adminClient, ENV, json, sendText } from "../_shared/wa.ts";

// ─── Verificação (GET) ───────────────────────
function handleVerify(url: URL): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === ENV.WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

function classifyButton(text: string, payload: string): "approve" | "adjust" | null {
  const s = `${text} ${payload}`.toLowerCase();
  if (s.includes("ajuste") || s.includes("ajust") || s.includes("adjust")) return "adjust";
  if (s.includes("aprov") || s.includes("approve")) return "approve";
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") return handleVerify(url);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Sempre responde 200 rápido para a Meta não reenviar; processa o que der.
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: true });
  }

  try {
    const db = adminClient();
    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const messages = value?.messages ?? [];
        for (const msg of messages) {
          await handleMessage(db, msg);
        }
      }
    }
  } catch (e) {
    console.error("wa-webhook error:", e);
  }

  return json({ ok: true });
});

// ─── Processa uma mensagem recebida ──────────
async function handleMessage(db: any, msg: any) {
  const from: string = msg?.from ?? "";
  const contextId: string | undefined = msg?.context?.id;

  // 1) TOQUE EM BOTÃO (template quick reply) -> type "button"
  if (msg?.type === "button" && msg?.button) {
    const kind = classifyButton(msg.button.text ?? "", msg.button.payload ?? "");
    const dispatch = await findDispatch(db, { wamId: contextId, phone: from });
    if (!dispatch) return;

    if (kind === "approve") {
      await approve(db, dispatch);
      await sendText(from, "✅ Conteúdo aprovado! Obrigado.");
    } else if (kind === "adjust") {
      await db
        .from("whatsapp_dispatches")
        .update({ status: "awaiting_reason" })
        .eq("id", dispatch.id);
      await sendText(
        from,
        "🔄 Sem problemas! Responda esta mensagem dizendo o que precisa ser ajustado.",
      );
    }
    return;
  }

  // 2) MENSAGEM DE TEXTO -> pode ser o motivo do ajuste
  if (msg?.type === "text" && msg?.text?.body) {
    const dispatch = await findDispatch(db, {
      phone: from,
      status: "awaiting_reason",
    });
    if (!dispatch) return; // não estamos esperando motivo desse cliente
    await requestAdjust(db, dispatch, msg.text.body.trim());
    await sendText(from, "🔄 Recebido! Nossa equipe vai revisar e enviar uma nova versão.");
  }
}

// ─── Localiza o dispatch correspondente ──────
async function findDispatch(
  db: any,
  opts: { wamId?: string; phone?: string; status?: string },
) {
  let q = db.from("whatsapp_dispatches").select("*");
  if (opts.wamId) {
    q = q.eq("wam_id", opts.wamId);
  } else {
    if (opts.phone) q = q.eq("phone", opts.phone);
    if (opts.status) q = q.eq("status", opts.status);
  }
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

// ─── Ações: gravam IGUAL ao fluxo web ────────
async function approve(db: any, dispatch: any) {
  const feedback = "✅ Conteúdo aprovado pelo cliente (WhatsApp).";
  await db.from("tasks").update({ status: "Aprovado" }).eq("id", dispatch.task_id);
  await db.from("approvals").insert({
    task_id: dispatch.task_id,
    client_id: dispatch.client_id,
    decision: "aprovado",
    feedback,
  });
  await db.from("task_comments").insert({ task_id: dispatch.task_id, text: feedback });
  await db
    .from("whatsapp_dispatches")
    .update({ status: "approved", feedback })
    .eq("id", dispatch.id);
}

async function requestAdjust(db: any, dispatch: any, reason: string) {
  const feedback = `🔄 Ajuste solicitado pelo cliente (WhatsApp): ${reason}`;
  await db
    .from("tasks")
    .update({ status: "Ajuste Solicitado" })
    .eq("id", dispatch.task_id);
  await db.from("approvals").insert({
    task_id: dispatch.task_id,
    client_id: dispatch.client_id,
    decision: "ajuste_solicitado",
    feedback,
  });
  await db.from("task_comments").insert({ task_id: dispatch.task_id, text: feedback });
  await db
    .from("whatsapp_dispatches")
    .update({ status: "adjust_requested", feedback })
    .eq("id", dispatch.id);
}
