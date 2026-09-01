// =============================================
// Edge Function: google-oauth-callback
// =============================================
// PÚBLICA (verify_jwt = false) — e tem que ser: quem chama é o navegador
// voltando do Google numa navegação de página inteira, sem cabeçalho
// Authorization. Mesma justificativa do wa-webhook.
//
// Quem prova a identidade aqui é o `state`, gravado pela google-oauth-start
// com o user_id tirado do JWT.
//
// CUIDADO IMPORTANTE: o `code` do Google morre aqui e NUNCA volta na URL do
// front. O js/supabase.js configura detectSessionInUrl:true, e o supabase-js
// inspeciona a URL no boot procurando por `?code=` (o PKCE dele). Se o código
// do Google aparecesse ali, ele tentaria trocá-lo por sessão e no mínimo
// poluiria o console — no pior caso, confundiria o estado de autenticação.

import {
  adminClient, ENV, lerIdToken, trocarCodigo,
} from "../_shared/google.ts";

function voltarParaApp(status: string, motivo?: string): Response {
  const url = new URL(ENV.APP_URL);
  url.searchParams.set("google", status);
  if (motivo) url.searchParams.set("motivo", motivo);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroGoogle = url.searchParams.get("error");

  // Usuário clicou em "Cancelar" na tela do Google
  if (erroGoogle) return voltarParaApp("erro", erroGoogle);
  if (!code || !state) return voltarParaApp("erro", "faltou_code_ou_state");

  const db = adminClient();

  const { data: st } = await db
    .from("google_oauth_states")
    .select("user_id, code_verifier, expires_at, used_at")
    .eq("state", state)
    .maybeSingle();

  if (!st || st.used_at || new Date(st.expires_at) < new Date()) {
    return voltarParaApp("erro", "state_invalido");
  }

  // Marca ANTES da troca: uso único. Um `code` interceptado e reenviado
  // encontra o state já consumido.
  await db.from("google_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state", state);

  let tokens;
  try {
    tokens = await trocarCodigo(code, st.code_verifier);
  } catch (e) {
    console.error("Troca de código falhou:", (e as Error).message);
    return voltarParaApp("erro", "troca_falhou");
  }

  const perfil = lerIdToken(tokens.id_token);

  // COALESCE no refresh_token: numa reconexão o Google pode responder SEM
  // refresh_token novo. Sobrescrever com null desconectaria a pessoa em
  // silêncio, e ela só descobriria na próxima vez que abrisse a Agenda.
  const { data: atual } = await db
    .from("google_credentials").select("refresh_token")
    .eq("user_id", st.user_id).maybeSingle();

  const refresh = tokens.refresh_token ?? atual?.refresh_token;
  if (!refresh) return voltarParaApp("erro", "sem_refresh_token");

  const { error } = await db.from("google_credentials").upsert({
    user_id: st.user_id,
    google_sub: perfil.sub ?? null,
    google_email: perfil.email ?? null,
    refresh_token: refresh,
    access_token: tokens.access_token,
    access_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    scope: tokens.scope ?? null,
    revoked_at: null,
    last_error: null,
    connected_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Falha ao gravar credenciais:", error);
    return voltarParaApp("erro", "gravacao_falhou");
  }

  await db.from("google_oauth_states").delete().eq("state", state);
  return voltarParaApp("ok");
});
