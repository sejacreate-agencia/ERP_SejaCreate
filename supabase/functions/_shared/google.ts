// =============================================
// Helpers compartilhados da integração com Google Agenda
// =============================================
// Espelha o _shared/wa.ts: ENV, CORS, json(), adminClient().
// Acrescenta a autenticação por CONTA DE SERVIÇO — sem OAuth de usuário,
// sem refresh token e sem tela de consentimento.
//
// Como funciona: a conta de serviço assina um JWT com a própria chave
// privada e troca esse JWT por um access_token no endpoint do Google. Ela
// só enxerga as agendas que tiverem sido COMPARTILHADAS com o e-mail dela
// (Google Agenda → Configurações → Compartilhar com pessoas específicas).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── ENV ─────────────────────────────────────
// Sem valor literal de fallback: o repositório inteiro, incluindo supabase/,
// é publicado no GitHub Pages.
export const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  SA_EMAIL: Deno.env.get("GOOGLE_SA_EMAIL") ?? "",
  // A chave vem do JSON da conta de serviço. Guardada com \n escapado
  // (é o formato que sobrevive ao `supabase secrets set`) e desescapada aqui.
  SA_PRIVATE_KEY: (Deno.env.get("GOOGLE_SA_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n"),
  TZ: Deno.env.get("APP_TIMEZONE") ?? "America/Sao_Paulo",
};

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

// ─── AUTENTICAÇÃO DA CONTA DE SERVIÇO ────────

const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Converte a chave PEM (PKCS#8) do JSON da conta de serviço em CryptoKey
async function importarChave(pem: string): Promise<CryptoKey> {
  const corpo = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(corpo);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return await crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Cache em memória: a instância da function costuma atender várias chamadas
// seguidas, e cada token vale 1 hora. Sem isso seriam duas idas ao Google
// por navegação de dia na Agenda.
let _token: { valor: string; expira: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (!ENV.SA_EMAIL || !ENV.SA_PRIVATE_KEY) {
    throw new Error("google_nao_configurado");
  }
  if (_token && _token.expira > Date.now() + 60_000) return _token.valor;

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = { alg: "RS256", typ: "JWT" };
  const corpo = {
    iss: ENV.SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  };

  const base = `${b64url(new TextEncoder().encode(JSON.stringify(cabecalho)))}.${
    b64url(new TextEncoder().encode(JSON.stringify(corpo)))
  }`;
  const chave = await importarChave(ENV.SA_PRIVATE_KEY);
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chave,
    new TextEncoder().encode(base),
  );
  const jwt = `${base}.${b64url(assinatura)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const dados = await res.json();
  if (!res.ok || !dados.access_token) {
    console.error("Falha ao obter token do Google:", dados);
    throw new Error("google_auth_failed");
  }

  _token = {
    valor: dados.access_token,
    expira: Date.now() + (dados.expires_in ?? 3600) * 1000,
  };
  return _token.valor;
}

// ─── CALENDAR API ────────────────────────────

const API = "https://www.googleapis.com/calendar/v3";

async function chamar(caminho: string, init: RequestInit = {}) {
  const token = await getAccessToken();
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
    // 404 aqui quase sempre significa que a pessoa não compartilhou a agenda
    // com a conta de serviço — vale distinguir, é o erro mais comum na estreia.
    const motivo = res.status === 404 || res.status === 403
      ? "agenda_nao_compartilhada"
      : "google_api_failed";
    console.error(`Google API ${res.status} em ${caminho}:`, corpo);
    const err = new Error(motivo);
    (err as { detalhe?: unknown }).detalhe = corpo?.error?.message;
    throw err;
  }
  return corpo;
}

// Eventos de um dia. `dia` no formato YYYY-MM-DD.
export async function listarEventos(calendarId: string, dia: string) {
  const inicio = `${dia}T00:00:00`;
  const fim = `${dia}T23:59:59`;
  const q = new URLSearchParams({
    timeMin: `${inicio}${offsetDoFuso(inicio)}`,
    timeMax: `${fim}${offsetDoFuso(fim)}`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const dados = await chamar(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
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

export async function criarEvento(calendarId: string, ev: {
  titulo: string;
  dia: string;
  horaInicio: string;
  horaFim: string;
  descricao?: string;
}) {
  // dateTime SEM 'Z' + timeZone ao lado. Concatenar Z (ou usar toISOString de
  // um horário local) é a origem clássica do evento que aparece 3h fora.
  const corpo = {
    summary: ev.titulo,
    description: ev.descricao ?? undefined,
    start: { dateTime: `${ev.dia}T${ev.horaInicio}:00`, timeZone: ENV.TZ },
    end: { dateTime: `${ev.dia}T${ev.horaFim}:00`, timeZone: ENV.TZ },
  };
  const criado = await chamar(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(corpo) },
  );
  return { id: criado.id, link: criado.htmlLink };
}

// O timeMin/timeMax do Google exige offset explícito. Calcula o do fuso
// configurado na data em questão — assim o horário de verão, se voltar a
// existir, não quebra a janela do dia.
function offsetDoFuso(dataLocal: string): string {
  const d = new Date(`${dataLocal}Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ENV.TZ,
    timeZoneName: "longOffset",
  });
  const parte = fmt.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  const m = parte.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-03:00";
}
