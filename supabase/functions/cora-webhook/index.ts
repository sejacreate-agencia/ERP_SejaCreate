// =============================================
// Edge Function: cora-webhook
// =============================================
// PÚBLICA (verify_jwt = false), obrigatoriamente: a Cora chama sem
// Authorization.
//
// O DESENHO CENTRAL, e o motivo de ele ser assim:
// a notificação da Cora chega com CORPO VAZIO e sem assinatura — só os
// cabeçalhos webhook-event-id, webhook-event-type e webhook-resource-id. Não há
// HMAC nem segredo compartilhado para conferir.
//
// A resposta não é inventar um token e fingir que autentica. É NUNCA CONFIAR NA
// NOTIFICAÇÃO: ela é tratada como um aviso de "algo mudou", e a verdade vem de
// um GET /v2/invoices/{id} que NÓS fazemos, com o nosso próprio token. Quem
// forjar uma notificação consegue, no máximo, nos fazer consultar a nossa
// própria API.
//
// O token no path serve para não sermos varridos por scanner — é limitação de
// ruído, não autenticação.

import { adminClient, igualSeguro, json } from "../_shared/base.ts";
import {
  consultarCobranca, CORA_ENV, PROVIDER,
} from "../_shared/cora.ts";

// A Cora reenvia o que não recebe 200. Responder 200 mesmo em erro é
// deliberado — o mesmo que wa-webhook faz com a Meta. O erro fica gravado na
// linha do evento, visível pela ação `eventos` da função cora.
const ok = (extra: Record<string, unknown> = {}) => json({ ok: true, ...extra });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Token do PATH: /cora-webhook/<token>
  const partes = new URL(req.url).pathname.split("/").filter(Boolean);
  const token = partes[partes.length - 1] ?? "";
  if (
    !CORA_ENV.WEBHOOK_TOKEN ||
    token === "cora-webhook" ||
    !igualSeguro(token, CORA_ENV.WEBHOOK_TOKEN)
  ) {
    // 404, não 403: não confirmar que o endpoint existe.
    return new Response("not found", { status: 404 });
  }

  const h = req.headers;
  const eventType = h.get("webhook-event-type") ?? "";
  const resourceId = h.get("webhook-resource-id") ?? "";
  // Sem event-id não dá para deduplicar. O id sintético agrupa por minuto:
  // duas entregas do mesmo evento no mesmo minuto colidem, que é o que se quer.
  const eventId = h.get("webhook-event-id") ??
    `sint_${resourceId}_${eventType}_${new Date().toISOString().slice(0, 16)}`;

  const db = adminClient();

  // A PK composta (provider, event_id) É a trava de replay. A segunda entrega
  // do mesmo evento viola a chave e sai daqui sem tocar em dinheiro.
  const { error: erroIns } = await db.from("provider_webhook_events").insert({
    provider: PROVIDER,
    event_id: eventId,
    event_type: eventType,
    resource_id: resourceId,
    headers: {
      "webhook-event-type": eventType,
      "webhook-resource-id": resourceId,
      "user-agent": h.get("user-agent"),
    },
  });
  if (erroIns) {
    if (erroIns.code === "23505") return ok({ duplicado: true });
    console.error("cora-webhook: falha ao registrar evento:", erroIns.message);
    return ok({ registrado: false });
  }

  const marcar = (resultado: string, erro?: string) =>
    db.from("provider_webhook_events")
      .update({ processado_em: new Date().toISOString(), resultado, erro: erro ?? null })
      .eq("provider", PROVIDER).eq("event_id", eventId);

  if (!resourceId) {
    await marcar("sem_resource_id");
    return ok({ ignorado: true });
  }

  // Cobrança que não é nossa: registra e sai. Responder igual para conhecida e
  // desconhecida impede que alguém use este endpoint para enumerar ids.
  const { data: charge } = await db.from("payment_charges")
    .select("id, provider_charge_id, ambiente, formas")
    .eq("provider_charge_id", resourceId).maybeSingle();
  if (!charge) {
    await marcar("desconhecida");
    return ok({ conhecida: false });
  }

  try {
    // READ-BACK: a verdade vem daqui, não do POST recebido.
    const inv = await consultarCobranca(resourceId, charge.ambiente);
    const status = String(inv.status ?? "");

    const { data: r, error } = await db.rpc("cora_liquidar_cobranca", {
      p_provider_charge_id: resourceId,
      p_provider_status: status,
      p_total_paid_cents: Number(inv.total_paid ?? 0),
      p_occurrence_date: (inv.occurrence_date as string) ?? null,
      p_forma_pagamento: status === "PAID"
        ? (charge.formas?.includes("PIX") ? "PIX" : "Boleto")
        : null,
      p_payload: inv,
    });
    if (error) throw new Error(error.message);

    const res = r as Record<string, unknown>;
    await marcar(JSON.stringify(res).slice(0, 300));

    // Emissão fiscal fora do caminho crítico: se o Sefin estiver fora do ar, a
    // baixa financeira já está commitada e a nota fica na fila.
    if (res?.nfse_status === "pendente_emissao") {
      const alvo = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nfse`;
      const chamada = fetch(alvo, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acao: "processar_pendentes", limite: 3 }),
      }).catch((e) => console.error("nfse pendentes:", (e as Error).message));

      const rt = globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } };
      rt.EdgeRuntime?.waitUntil?.(chamada);
    }

    return ok({ resultado: res });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("cora-webhook falhou:", msg);
    await marcar("erro", msg.slice(0, 300));
    // 200 mesmo assim: a Cora reenviaria, e o replay não conserta um erro
    // nosso. O evento fica marcado para reprocessamento manual.
    return ok({ erro: true });
  }
});
