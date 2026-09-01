// =============================================
// Edge Function: google-oauth-start
// =============================================
// Devolve a URL de consentimento do Google para o usuário logado no ERP.
// O front então navega para lá (window.location.href).
//
// O `state` é gerado AQUI, e não no navegador, de propósito: ele só tem valor
// como prova de identidade porque foi criado por quem validou o JWT. Gerado no
// browser, seria um número que o próprio browser escolheu — inútil.

import {
  adminClient, CORS, desafioPKCE, ENV, json,
  novoSegredo, REDIRECT_URI, SCOPES, usuarioDoToken,
} from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await usuarioDoToken(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  if (!ENV.CLIENT_ID || !ENV.CLIENT_SECRET) {
    return json({ error: "google_nao_configurado" }, 503);
  }

  const db = adminClient();

  // Limpeza oportunista dos states vencidos — evita precisar de cron
  await db.from("google_oauth_states").delete().lt("expires_at", new Date().toISOString());

  const state = novoSegredo();
  const verifier = novoSegredo(64);
  const challenge = await desafioPKCE(verifier);

  const { error } = await db.from("google_oauth_states").insert({
    state, user_id: userId, code_verifier: verifier,
  });
  if (error) {
    console.error("Falha ao gravar o state:", error);
    return json({ error: "state_falhou" }, 500);
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", ENV.CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // offline + consent: sem os dois, uma reconexão pode vir SEM refresh_token
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return json({ auth_url: url.toString() });
});
