// =============================================
// Edge Function: cora-oauth-start
// =============================================
// Devolve a URL de consentimento da Cora. O front então navega para lá
// (window.location.href), como no Google Agenda — e pelo mesmo motivo: popup
// no PWA do iOS abre fora do app.
//
// O `state` é gerado AQUI, e não no navegador. Ele só vale como prova porque
// foi criado por quem validou o JWT; gerado no browser seria um número que o
// próprio browser escolheu.
//
// Sem `state`, o ataque é direto: alguém autoriza o NOSSO app na PRÓPRIA conta
// Cora, chama o nosso callback com aquele código, e a conta bancária da agência
// é substituída pela dele — cobranças passariam a cair na conta do atacante.

import {
  adminClient, CORS, exigirPerfil, json, novoSegredo, usuarioDoToken,
} from "../_shared/base.ts";
import {
  configurada, CORA_ENV, PROVIDER, urlDeAutorizacao,
} from "../_shared/cora.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await usuarioDoToken(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  // Conectar a conta bancária da empresa é ato de administrador.
  const { ok } = await exigirPerfil(userId, ["admin"]);
  if (!ok) return json({ error: "sem_permissao" }, 403);

  if (!configurada()) return json({ error: "cora_nao_configurada" }, 503);

  const db = adminClient();

  // Limpeza oportunista dos states vencidos — evita precisar de cron.
  await db.from("integration_oauth_states")
    .delete().lt("expires_at", new Date().toISOString());

  const state = novoSegredo();
  const { error } = await db.from("integration_oauth_states").insert({
    state, provider: PROVIDER, ambiente: CORA_ENV.AMBIENTE, user_id: userId,
  });
  if (error) {
    console.error("cora-oauth-start: falha ao gravar o state:", error);
    return json({ error: "state_falhou" }, 500);
  }

  return json({ auth_url: urlDeAutorizacao(state), ambiente: CORA_ENV.AMBIENTE });
});
