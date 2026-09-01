// =============================================
// Edge Function: gcal
// =============================================
// Ponte entre o ERP e o Google Agenda, usando uma CONTA DE SERVIÇO.
// Chamada pelo front (autenticada pelo JWT do usuário) via:
//   supabaseClient.functions.invoke('gcal', { body: { acao: 'listar', dia } })
//
// Ações: verificar | listar | criar | desconectar
//
// REGRA DURA: o usuário vem SEMPRE do JWT, nunca do body. Um parâmetro
// user_id "para o admin ver a agenda dos outros" seria escalação de
// privilégio silenciosa.

import {
  adminClient,
  CORS,
  criarEvento,
  ENV,
  json,
  listarEventos,
} from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const db = adminClient();
  const { data: userData } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: {
    acao?: string;
    dia?: string;
    calendar_id?: string;
    titulo?: string;
    hora_inicio?: string;
    hora_fim?: string;
    descricao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!ENV.SA_EMAIL || !ENV.SA_PRIVATE_KEY) {
    return json({ error: "google_nao_configurado" }, 503);
  }

  // Agenda configurada para este usuário
  const carregarAgenda = async () => {
    const { data } = await db
      .from("google_calendars")
      .select("calendar_id, verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  };

  const marcarOk = async (calendarId: string) => {
    await db.from("google_calendars").upsert({
      user_id: userId,
      calendar_id: calendarId,
      verified_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "user_id" });
  };

  // Falha NÃO pode sobrescrever uma configuração que funciona: digitar um
  // e-mail errado uma vez derrubaria a agenda já conectada. Só registra o erro
  // quando é a mesma agenda que já estava salva.
  const marcarErro = async (calendarId: string, erro: string) => {
    const atual = await carregarAgenda();
    if (atual?.calendar_id === calendarId) {
      await db.from("google_calendars")
        .update({ verified_at: null, last_error: erro })
        .eq("user_id", userId);
    }
  };

  try {
    switch (body.acao) {
      // ── Testa o acesso e salva. Chamado pelo botão "Verificar acesso". ──
      case "verificar": {
        const calendarId = (body.calendar_id ?? "").trim().toLowerCase();
        if (!calendarId) return json({ error: "calendar_id_required" }, 400);

        const hoje = new Date().toISOString().slice(0, 10);
        try {
          await listarEventos(calendarId, hoje);
        } catch (e) {
          const motivo = (e as Error).message;
          await marcarErro(calendarId, motivo);
          return json({ error: motivo, detalhe: (e as { detalhe?: string }).detalhe }, 422);
        }

        await marcarOk(calendarId);
        return json({ ok: true, calendar_id: calendarId, conta_servico: ENV.SA_EMAIL });
      }

      // ── Estado atual, para a tela de Configurações e a Agenda ──
      case "status": {
        const agenda = await carregarAgenda();
        return json({
          conectado: !!agenda?.verified_at,
          calendar_id: agenda?.calendar_id ?? null,
          conta_servico: ENV.SA_EMAIL,
        });
      }

      // ── Eventos de um dia ──
      case "listar": {
        const dia = body.dia ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ error: "dia_invalido" }, 400);

        const agenda = await carregarAgenda();
        if (!agenda?.calendar_id) return json({ error: "agenda_nao_configurada" }, 404);

        const eventos = await listarEventos(agenda.calendar_id, dia);
        return json({ eventos });
      }

      // ── Cria um compromisso ──
      case "criar": {
        const agenda = await carregarAgenda();
        if (!agenda?.calendar_id) return json({ error: "agenda_nao_configurada" }, 404);

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

        const criado = await criarEvento(agenda.calendar_id, {
          titulo, dia, horaInicio: hi, horaFim: hf, descricao: body.descricao,
        });
        return json({ ok: true, ...criado });
      }

      // ── Remove a configuração (não apaga nada no Google) ──
      case "desconectar": {
        await db.from("google_calendars").delete().eq("user_id", userId);
        return json({ ok: true });
      }

      default:
        return json({ error: "acao_desconhecida" }, 400);
    }
  } catch (e) {
    const motivo = (e as Error).message;
    console.error("gcal falhou:", motivo, (e as { detalhe?: string }).detalhe);
    const status = motivo === "agenda_nao_compartilhada" ? 422 : 502;
    return json({ error: motivo, detalhe: (e as { detalhe?: string }).detalhe }, status);
  }
});
