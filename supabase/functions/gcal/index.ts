// =============================================
// Edge Function: gcal
// =============================================
// Ponte entre o ERP e o Google Agenda, com a autorização do PRÓPRIO usuário
// (OAuth). Chamada pelo front via:
//   supabaseClient.functions.invoke('gcal', { body: { acao: 'listar', dia } })
//
// Ações: status | listar | criar | desconectar
//
// REGRA DURA: o usuário vem SEMPRE do JWT, nunca do body. Um parâmetro
// user_id "para o admin ver a agenda dos outros" seria escalação de
// privilégio silenciosa.

import {
  adminClient, CORS, criarEvento, ENV, json,
  listarEventos, revogar, tokenDoUsuario, usuarioDoToken,
} from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await usuarioDoToken(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: {
    acao?: string; dia?: string; titulo?: string;
    hora_inicio?: string; hora_fim?: string; descricao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!ENV.CLIENT_ID || !ENV.CLIENT_SECRET) {
    return json({ error: "google_nao_configurado" }, 503);
  }

  const db = adminClient();

  try {
    switch (body.acao) {
      // ── Estado da conexão, para a tela de Configurações e a Agenda ──
      case "status": {
        const { data } = await db
          .from("google_credentials")
          .select("google_email, connected_at, revoked_at")
          .eq("user_id", userId)
          .maybeSingle();
        return json({
          conectado: !!data && !data.revoked_at,
          precisa_reconectar: !!data?.revoked_at,
          email: data?.google_email ?? null,
          conectado_em: data?.connected_at ?? null,
        });
      }

      // ── Eventos de um dia ──
      case "listar": {
        const dia = body.dia ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ error: "dia_invalido" }, 400);
        const { token, calendarId } = await tokenDoUsuario(userId);
        return json({ eventos: await listarEventos(token, calendarId, dia) });
      }

      // ── Cria um compromisso ──
      case "criar": {
        const titulo = (body.titulo ?? "").trim();
        const dia = body.dia ?? "";
        const hi = body.hora_inicio ?? "";
        const hf = body.hora_fim ?? "";
        if (!titulo) return json({ error: "titulo_required" }, 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ error: "dia_invalido" }, 400);
        if (!/^\d{2}:\d{2}$/.test(hi) || !/^\d{2}:\d{2}$/.test(hf)) {
          return json({ error: "hora_invalida" }, 400);
        }
        if (hf <= hi) return json({ error: "fim_antes_do_inicio" }, 400);

        const { token, calendarId } = await tokenDoUsuario(userId);
        const criado = await criarEvento(token, calendarId, {
          titulo, dia, horaInicio: hi, horaFim: hf, descricao: body.descricao,
        });
        return json({ ok: true, ...criado });
      }

      // ── Desconecta: revoga no Google e apaga daqui ──
      case "desconectar": {
        const { data } = await db
          .from("google_credentials").select("refresh_token")
          .eq("user_id", userId).maybeSingle();
        if (data?.refresh_token) await revogar(data.refresh_token);
        await db.from("google_credentials").delete().eq("user_id", userId);
        return json({ ok: true });
      }

      default:
        return json({ error: "acao_desconhecida" }, 400);
    }
  } catch (e) {
    const motivo = (e as Error).message;
    console.error("gcal falhou:", motivo, (e as { detalhe?: string }).detalhe);
    // 'nao_conectado' e 'reautorizar' são estados esperados, não falhas do
    // servidor: o front usa esses códigos para mostrar o botão de conectar.
    const status = motivo === "nao_conectado" ? 404
      : motivo === "reautorizar" ? 401
      : 502;
    return json({ error: motivo, detalhe: (e as { detalhe?: string }).detalhe }, status);
  }
});
