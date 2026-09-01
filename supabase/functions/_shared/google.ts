// =============================================
// Helpers compartilhados da integração com Google Agenda
// =============================================
// Espelha o _shared/wa.ts: ENV, CORS, json(), adminClient().
// Acrescenta o fluxo OAuth por usuário: cada pessoa clica em "Conectar com o
// Google", autoriza, e o refresh token fica guardado no servidor.
//
// NADA de token do Google chega ao navegador — o oposto do metaService.js,
// que guarda page_token em localStorage e chama a API direto de lá.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── ENV ─────────────────────────────────────
// Sem valor literal de fallback: o repositório inteiro, incluindo supabase/,
// é publicado no GitHub Pages.
export const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  CLIENT_ID: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
  CLIENT_SECRET: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
  APP_URL: Deno.env.get("APP_URL") ?? "https://app.sejacreate.com.br",
  TZ: Deno.env.get("APP_TIMEZONE") ?? "America/Sao_Paulo",
};

export const REDIRECT_URI = `${ENV.SUPABASE_URL}/functions/v1/google-oauth-callback`;

// Mínimo necessário: calendar.events cobre ler o dia E criar evento.
// openid+email só para saber qual conta foi conectada e mostrar na tela.
export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

// ─── CORS ────────────────────────────────────
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

// ─── SUPABASE (service role — ignora RLS) ─────
export function adminClient(): SupabaseClient {
  return createClient(ENV.SUPABASE_URL, ENV.SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Valida o JWT do ERP e devolve o id do usuário. Usado pelas funções
// autenticadas; evita repetir o bloco em cada uma.
export async function usuarioDoToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data } = await adminClient().auth.getUser(auth.replace("Bearer ", ""));
  return data?.user?.id ?? null;
}

// ─── PKCE ────────────────────────────────────
const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function novoSegredo(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function desafioPKCE(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(hash);
}

// ─── TOKENS ──────────────────────────────────

export async function trocarCodigo(code: string, codeVerifier: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.CLIENT_ID,
      client_secret: ENV.CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  const dados = await res.json();
  if (!res.ok) {
    console.error("Troca de código falhou:", dados);
    throw new Error("google_token_exchange_failed");
  }
  return dados as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

// O id_token vem direto do endpoint do Google por HTTPS, então dá para ler o
// payload sem validar a assinatura — não veio de terceiro.
export function lerIdToken(idToken?: string): { sub?: string; email?: string } {
  if (!idToken) return {};
  try {
    const p = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch {
    return {};
  }
}

// Devolve um access_token válido para o usuário, renovando se preciso.
// Lança 'nao_conectado' ou 'reautorizar' — códigos que o front traduz.
export async function tokenDoUsuario(userId: string): Promise<{ token: string; calendarId: string }> {
  const db = adminClient();
  const { data: cred } = await db
    .from("google_credentials")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!cred) throw new Error("nao_conectado");
  if (cred.revoked_at) throw new Error("reautorizar");

  // Cache: o access_token vale ~1h. Sem isto seria uma ida ao Google a cada
  // navegação de dia na Agenda.
  const validoAte = cred.access_expires_at ? new Date(cred.access_expires_at).getTime() : 0;
  if (cred.access_token && validoAte > Date.now() + 60_000) {
    return { token: cred.access_token, calendarId: cred.calendar_id || "primary" };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.CLIENT_ID,
      client_secret: ENV.CLIENT_SECRET,
      refresh_token: cred.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const dados = await res.json();

  if (!res.ok) {
    // invalid_grant = o usuário revogou o acesso, ou o token morreu.
    // Marca para o front pedir reconexão em vez de falhar em silêncio.
    const invalido = dados?.error === "invalid_grant";
    console.error("Refresh falhou:", dados);
    if (invalido) {
      await db.from("google_credentials")
        .update({ revoked_at: new Date().toISOString(), last_error: "invalid_grant", access_token: null })
        .eq("user_id", userId);
      throw new Error("reautorizar");
    }
    throw new Error("google_auth_failed");
  }

  await db.from("google_credentials").update({
    access_token: dados.access_token,
    access_expires_at: new Date(Date.now() + (dados.expires_in ?? 3600) * 1000).toISOString(),
    last_error: null,
  }).eq("user_id", userId);

  return { token: dados.access_token, calendarId: cred.calendar_id || "primary" };
}

export async function revogar(refreshToken: string) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch (e) {
    // Falhar aqui não impede desconectar do nosso lado
    console.error("Revoke falhou (seguindo assim mesmo):", e);
  }
}

// ─── CALENDAR API ────────────────────────────

const API = "https://www.googleapis.com/calendar/v3";

async function chamar(token: string, caminho: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Google API ${res.status} em ${caminho}:`, corpo);
    const err = new Error(res.status === 401 ? "reautorizar" : "google_api_failed");
    (err as { detalhe?: unknown }).detalhe = corpo?.error?.message;
    throw err;
  }
  return corpo;
}

export async function listarEventos(token: string, calendarId: string, dia: string) {
  const q = new URLSearchParams({
    timeMin: `${dia}T00:00:00${offsetDoFuso(dia)}`,
    timeMax: `${dia}T23:59:59${offsetDoFuso(dia)}`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const dados = await chamar(token, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
  return (dados.items ?? []).map((e: Record<string, any>) => ({
    id: e.id,
    titulo: e.summary ?? "(sem título)",
    inicio: e.start?.dateTime ?? null,
    fim: e.end?.dateTime ?? null,
    diaTodo: !!e.start?.date,
    link: e.htmlLink,
    local: e.location ?? null,
  }));
}

export async function criarEvento(token: string, calendarId: string, ev: {
  titulo: string; dia: string; horaInicio: string; horaFim: string; descricao?: string;
}) {
  // dateTime SEM 'Z' + timeZone ao lado. Concatenar Z (ou usar toISOString de
  // um horário local) é a origem clássica do evento que aparece 3h fora.
  const corpo = {
    summary: ev.titulo,
    description: ev.descricao ?? undefined,
    start: { dateTime: `${ev.dia}T${ev.horaInicio}:00`, timeZone: ENV.TZ },
    end: { dateTime: `${ev.dia}T${ev.horaFim}:00`, timeZone: ENV.TZ },
  };
  const criado = await chamar(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST", body: JSON.stringify(corpo),
  });
  return { id: criado.id, link: criado.htmlLink };
}

// O timeMin/timeMax do Google exige offset explícito. Calcula o do fuso
// configurado naquela data — assim horário de verão, se voltar, não quebra.
function offsetDoFuso(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: ENV.TZ, timeZoneName: "longOffset" });
  const parte = fmt.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  const m = parte.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-03:00";
}
