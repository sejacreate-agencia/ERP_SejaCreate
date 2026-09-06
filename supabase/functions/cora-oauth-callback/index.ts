// =============================================
// Edge Function: cora-oauth-callback
// =============================================
// PÚBLICA (verify_jwt = false) — e tem que ser: quem chama é o navegador
// voltando da Cora numa navegação de página inteira, sem Authorization.
//
// Quem prova a identidade é o `state`, gravado pela cora-oauth-start com o
// user_id tirado do JWT.
//
// Este é o endereço que vai no campo "link de redirecionamento" do painel da
// Cora. NÃO use a URL do app: o js/supabase.js roda com detectSessionInUrl,
// e o supabase-js inspeciona a URL no boot procurando `?code=`. O código da
// Cora ali seria confundido com um login.

import { adminClient, registrarLog } from "../_shared/base.ts";
import { BASE_ENV } from "../_shared/base.ts";
import {
  CORA_ENV, PROVIDER, trocarCodigo,
} from "../_shared/cora.ts";

function voltarParaApp(status: string, motivo?: string): Response {
  const url = new URL(BASE_ENV.APP_URL);
  url.searchParams.set("cora", status);
  if (motivo) url.searchParams.set("motivo", motivo);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroCora = url.searchParams.get("error");

  // Clicou em "Cancelar" na tela da Cora
  if (erroCora) return voltarParaApp("erro", erroCora);
  if (!code || !state) return voltarParaApp("erro", "faltou_code_ou_state");

  const db = adminClient();

  const { data: st } = await db
    .from("integration_oauth_states")
    .select("provider, ambiente, org_id, user_id, expires_at, used_at")
    .eq("state", state)
    .maybeSingle();

  if (
    !st || st.used_at || st.provider !== PROVIDER ||
    new Date(st.expires_at) < new Date()
  ) {
    return voltarParaApp("erro", "state_invalido");
  }

  // Marca ANTES da troca: uso único. Um `code` interceptado e reenviado
  // encontra o state já consumido.
  await db.from("integration_oauth_states")
    .update({ used_at: new Date().toISOString() }).eq("state", state);

  let tokens;
  try {
    tokens = await trocarCodigo(code, st.ambiente as "stage" | "producao");
  } catch (e) {
    console.error("cora-oauth-callback: troca falhou:", (e as Error).message);
    return voltarParaApp("erro", "troca_falhou");
  }

  if (!tokens.refresh_token) {
    // Sem refresh a conexão morre em 24h e ninguém entende por quê.
    return voltarParaApp("erro", "sem_refresh_token");
  }

  const agora = new Date().toISOString();
  const { error } = await db.from("integration_connections").upsert({
    org_id: st.org_id,
    provider: PROVIDER,
    ambiente: st.ambiente,
    status: "conectado",
    access_token: tokens.access_token,
    access_expires_at:
      new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString(),
    refresh_token: tokens.refresh_token,
    scope: tokens.scope ?? null,
    ultimo_refresh_em: agora,
    conectado_em: agora,
    desconectado_em: null,
    ultimo_erro: null,
  }, { onConflict: "org_id,provider,ambiente" });

  if (error) {
    console.error("cora-oauth-callback: gravação falhou:", error);
    return voltarParaApp("erro", "gravacao_falhou");
  }

  await db.from("integration_oauth_states").delete().eq("state", state);

  await registrarLog(
    "integracao.conectada", "integration_connection", null,
    { provider: PROVIDER, ambiente: st.ambiente },
    st.user_id,
  );

  return voltarParaApp("ok");
});
