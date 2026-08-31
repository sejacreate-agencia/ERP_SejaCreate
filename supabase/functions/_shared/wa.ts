// =============================================
// Helpers compartilhados das Edge Functions de WhatsApp
// =============================================
// Centraliza: cliente Supabase (service role), chamadas à
// Graph API do WhatsApp Cloud, CORS e normalização de telefone.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── ENV ─────────────────────────────────────
export const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  WHATSAPP_TOKEN: Deno.env.get("WHATSAPP_TOKEN") ?? "",
  PHONE_NUMBER_ID: Deno.env.get("PHONE_NUMBER_ID") ?? "",
  WEBHOOK_VERIFY_TOKEN: Deno.env.get("WEBHOOK_VERIFY_TOKEN") ?? "",
  // Nome e idioma do template aprovado na Meta
  TEMPLATE_NAME: Deno.env.get("WHATSAPP_TEMPLATE_NAME") ?? "aprovacao_conteudo",
  TEMPLATE_LANG: Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "pt_BR",
  GRAPH_VERSION: Deno.env.get("GRAPH_VERSION") ?? "v21.0",
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

// ─── TELEFONE ────────────────────────────────
// Normaliza para o formato E.164 sem '+' que a Meta espera
// (ex.: "(11) 99999-0000" -> "5511999990000"). Assume DDI 55 (Brasil)
// quando o número não vem com código do país.
export function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

// ─── GRAPH API ───────────────────────────────
const graphBase = () =>
  `https://graph.facebook.com/${ENV.GRAPH_VERSION}/${ENV.PHONE_NUMBER_ID}/messages`;

async function graphPost(payload: Record<string, unknown>) {
  const res = await fetch(graphBase(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Graph API ${res.status}: ${JSON.stringify(data?.error ?? data)}`,
    );
  }
  return data;
}

// Envia o template de aprovação (imagem no header + 2 botões quick reply).
// Os botões são definidos no próprio template aprovado na Meta.
// Retorna o wam_id (id da mensagem) para mapear o toque do cliente.
export async function sendApprovalTemplate(opts: {
  to: string;
  artUrl: string;
  clientName: string;
  title: string;
  caption: string;
}): Promise<string> {
  const payload = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: ENV.TEMPLATE_NAME,
      language: { code: ENV.TEMPLATE_LANG },
      components: [
        {
          type: "header",
          parameters: [
            { type: "image", image: { link: opts.artUrl } },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: opts.clientName || "Cliente" },
            { type: "text", text: opts.title || "Novo conteúdo" },
            { type: "text", text: truncate(opts.caption || "", 900) },
          ],
        },
      ],
    },
  };
  const data = await graphPost(payload);
  return data?.messages?.[0]?.id ?? "";
}

// Envia mensagem de texto livre (só dentro da janela de 24h).
export async function sendText(to: string, body: string): Promise<void> {
  await graphPost({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
