// =============================================
// Helpers compartilhados das Edge Functions
// =============================================
// CORS, json(), adminClient(), usuarioDoToken() e exigirPerfil().
//
// _shared/google.ts e _shared/wa.ts têm cópias próprias das quatro primeiras.
// Elas NÃO foram trocadas por imports daqui de propósito: são integrações em
// produção, e a economia de vinte e poucas linhas não paga o risco de mexer
// nelas. Se um dia alguém quiser unificar, que seja num commit isolado, com o
// WhatsApp e a Agenda testados depois.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sem valor literal de fallback para segredo: o repositório inteiro, incluindo
// supabase/, é publicado no GitHub Pages.
export const BASE_ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  APP_URL: Deno.env.get("APP_URL") ?? "https://app.sejacreate.com.br",
};

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// service_role: ignora RLS. Todo escopo de linha vira responsabilidade do
// código — sempre filtre explicitamente por org_id / user_id.
export function adminClient(): SupabaseClient {
  return createClient(BASE_ENV.SUPABASE_URL, BASE_ENV.SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function usuarioDoToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data } = await adminClient().auth.getUser(auth.replace("Bearer ", ""));
  return data?.user?.id ?? null;
}

// `verify_jwt = true` prova apenas que existe um usuário logado — e o perfil
// 'cliente' também está logado. Emitir e cancelar cobrança precisam desta
// segunda porta, conferida contra profiles.role no servidor.
//
// A matriz de permissões do front (js/data.js) NÃO serve para isso: ela vive no
// navegador, não é persistida, e volta ao default a cada recarga da página.
export async function exigirPerfil(
  userId: string,
  perfis: string[],
): Promise<{ ok: boolean; role: string | null }> {
  const { data } = await adminClient()
    .from("profiles").select("role, status").eq("id", userId).maybeSingle();
  if (!data || data.status === "inativo") return { ok: false, role: null };
  return { ok: perfis.includes(data.role), role: data.role };
}

// Compara duas strings em tempo constante. Usado nos tokens de webhook: um
// `===` vaza, pelo tempo de resposta, quantos caracteres iniciais bateram.
export function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Segredo aleatório em base64url — usado para `state` de OAuth e tokens de URL.
export function novoSegredo(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Trilha de auditoria. user_id é nullable em activity_logs, então o webhook —
// que não tem usuário — também consegue registrar.
export async function registrarLog(
  acao: string,
  recurso: string,
  recursoId: string | null,
  detalhes: Record<string, unknown>,
  userId: string | null = null,
): Promise<void> {
  try {
    await adminClient().from("activity_logs").insert({
      user_id: userId,
      action: acao,
      resource_type: recurso,
      resource_id: recursoId,
      details: detalhes,
    });
  } catch (e) {
    // Log que derruba a operação que ele deveria registrar é pior que log
    // ausente. Falha aqui nunca propaga.
    console.error("registrarLog falhou:", (e as Error).message);
  }
}
