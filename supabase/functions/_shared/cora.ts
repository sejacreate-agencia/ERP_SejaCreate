// =============================================
// Cliente da API da Cora — Parceria (OAuth2)
// =============================================
// Modelo: Parceria Cora, authorization_code. client_id + client_secret, sem
// certificado. A alternativa (Integração Direta) autentica por mTLS, e o
// suporte do Edge Runtime a isso é incerto — ver docs/cora-setup.md.
//
// A credencial é POR ORGANIZAÇÃO, não por usuário: a conta bancária é da
// empresa, não de quem clicou em "Conectar".
//
// Valores na API da Cora são INTEIROS EM CENTAVOS. R$ 10,01 é 1001. Todo
// cruzamento com `financial_receivables.value` (NUMERIC em reais) passa por
// reaisParaCentavos/centavosParaReais — nunca por `* 100` solto.

import { adminClient, BASE_ENV } from "./base.ts";

export const CORA_ENV = {
  CLIENT_ID: Deno.env.get("CORA_CLIENT_ID") ?? "",
  CLIENT_SECRET: Deno.env.get("CORA_CLIENT_SECRET") ?? "",
  AMBIENTE: (Deno.env.get("CORA_AMBIENTE") ?? "stage") as "stage" | "producao",
  WEBHOOK_TOKEN: Deno.env.get("CORA_WEBHOOK_TOKEN") ?? "",
};

export const PROVIDER = "cora";

export const REDIRECT_URI =
  `${BASE_ENV.SUPABASE_URL}/functions/v1/cora-oauth-callback`;

// Só o que o ERP usa: `invoice` para emitir e consultar cobrança, `account`
// para mostrar de qual conta é a conexão. NÃO pedimos `payment` nem
// `transfer` — o ERP cobra, não movimenta dinheiro para fora.
export const SCOPES = "invoice account";

export function baseUrl(ambiente = CORA_ENV.AMBIENTE): string {
  return ambiente === "producao"
    ? "https://api.cora.com.br"
    : "https://api.stage.cora.com.br";
}

export function configurada(): boolean {
  return !!(CORA_ENV.CLIENT_ID && CORA_ENV.CLIENT_SECRET);
}

// ─── Erros com código ────────────────────────
// Mesmo desenho do gcal: a função devolve um CÓDIGO, e o front traduz. Assim a
// mensagem técnica da Cora nunca chega ao usuário final.
export class ErroCora extends Error {
  codigo: string;
  detalhe?: string;
  constructor(codigo: string, detalhe?: string) {
    super(codigo);
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

// ─── Dinheiro ────────────────────────────────
export function reaisParaCentavos(v: number | string): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return 0;
  // Sem o round, 19.99 * 100 vira 1998.9999999999998 e o boleto sai um centavo
  // menor. É o clássico do ponto flutuante, e aqui custa dinheiro de verdade.
  return Math.round(n * 100);
}

export function centavosParaReais(c: number): number {
  return Math.round(c) / 100;
}

// ─── OAuth ───────────────────────────────────
function basicAuth(): string {
  return btoa(`${CORA_ENV.CLIENT_ID}:${CORA_ENV.CLIENT_SECRET}`);
}

export function urlDeAutorizacao(state: string, ambiente = CORA_ENV.AMBIENTE): string {
  const url = new URL(`${baseUrl(ambiente)}/oauth/authorize`);
  url.searchParams.set("client_id", CORA_ENV.CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  // A doc da Cora usa `scopes` (plural), diferente do padrão OAuth2.
  url.searchParams.set("scopes", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

async function pedirToken(
  corpo: Record<string, string>,
  ambiente = CORA_ENV.AMBIENTE,
): Promise<Tokens> {
  const resp = await fetch(`${baseUrl(ambiente)}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams(corpo),
  });
  const texto = await resp.text();
  if (!resp.ok) {
    // invalid_grant no refresh = a sessão morreu (60 dias de inatividade, ou
    // o usuário revogou na Cora). É estado, não falha de servidor.
    const expirou = /invalid_grant/i.test(texto);
    throw new ErroCora(
      expirou ? "reautorizar" : "token_falhou",
      `HTTP ${resp.status}: ${texto.slice(0, 200)}`,
    );
  }
  return JSON.parse(texto);
}

export function trocarCodigo(code: string, ambiente = CORA_ENV.AMBIENTE) {
  return pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  }, ambiente);
}

export function renovarToken(refresh: string, ambiente = CORA_ENV.AMBIENTE) {
  return pedirToken({ grant_type: "refresh_token", refresh_token: refresh }, ambiente);
}

// ─── Conexão da organização ──────────────────
export type Conexao = {
  id: string;
  org_id: string;
  ambiente: string;
  status: string;
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
  scope: string | null;
  conta_nome: string | null;
  conta_documento: string | null;
  webhook_endpoint_id: string | null;
  ultimo_refresh_em: string | null;
  ultimo_erro: string | null;
  conectado_em: string | null;
};

export async function conexaoAtual(
  ambiente = CORA_ENV.AMBIENTE,
): Promise<Conexao | null> {
  const { data } = await adminClient()
    .from("integration_connections")
    .select("*")
    .eq("provider", PROVIDER)
    .eq("ambiente", ambiente)
    .maybeSingle();
  return (data as Conexao) ?? null;
}

// Devolve um access_token válido, renovando se necessário.
//
// Duas coisas importantes acontecem aqui:
//  - cache: sem ele, todo clique gastaria um round trip de OAuth. O token vale
//    24h; renovamos com 5 min de folga.
//  - rotação: cada refresh devolve um refresh_token NOVO, e é ele que precisa
//    ser gravado. O anterior continua válido por até 3 usos como tolerância a
//    falha de rede — mas não dá para depender disso.
export async function tokenDaOrg(ambiente = CORA_ENV.AMBIENTE): Promise<string> {
  if (!configurada()) throw new ErroCora("cora_nao_configurada");

  const cx = await conexaoAtual(ambiente);
  if (!cx || !cx.refresh_token) throw new ErroCora("nao_conectado");
  if (cx.status === "desconectado") throw new ErroCora("nao_conectado");

  const folga = 5 * 60 * 1000;
  if (
    cx.access_token && cx.access_expires_at &&
    new Date(cx.access_expires_at).getTime() - Date.now() > folga
  ) {
    return cx.access_token;
  }

  const db = adminClient();
  try {
    const t = await renovarToken(cx.refresh_token, ambiente);
    await db.from("integration_connections").update({
      access_token: t.access_token,
      access_expires_at: new Date(Date.now() + (t.expires_in ?? 86400) * 1000).toISOString(),
      // COALESCE no refresh: se a Cora não devolver um novo, o antigo segue
      // valendo. Sobrescrever com null desconectaria a empresa em silêncio.
      refresh_token: t.refresh_token ?? cx.refresh_token,
      scope: t.scope ?? cx.scope,
      status: "conectado",
      ultimo_refresh_em: new Date().toISOString(),
      ultimo_erro: null,
    }).eq("id", cx.id);
    return t.access_token;
  } catch (e) {
    const err = e as ErroCora;
    await db.from("integration_connections").update({
      status: err.codigo === "reautorizar" ? "expirado" : "erro",
      ultimo_erro: err.detalhe ?? err.codigo,
    }).eq("id", cx.id);
    throw err;
  }
}

// ─── Chamadas à API ──────────────────────────
async function chamar(
  metodo: string,
  caminho: string,
  opts: { corpo?: unknown; idempotencia?: string; ambiente?: string } = {},
): Promise<{ status: number; dados: unknown }> {
  const ambiente = opts.ambiente ?? CORA_ENV.AMBIENTE;
  const token = await tokenDaOrg(ambiente as "stage" | "producao");

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
  };
  if (opts.corpo !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencia) headers["Idempotency-Key"] = opts.idempotencia;

  const resp = await fetch(`${baseUrl(ambiente as "stage" | "producao")}${caminho}`, {
    method: metodo,
    headers,
    body: opts.corpo !== undefined ? JSON.stringify(opts.corpo) : undefined,
  });

  const texto = await resp.text();
  let dados: unknown = null;
  if (texto) { try { dados = JSON.parse(texto); } catch { dados = texto; } }

  if (!resp.ok) {
    throw new ErroCora("cora_api_falhou", `HTTP ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return { status: resp.status, dados };
}

export type ClienteCobranca = {
  name: string;
  email?: string;
  document: { identity: string; type: "CPF" | "CNPJ" };
  address: {
    street: string; number: string; district: string;
    city: string; state: string; complement?: string; zip_code: string;
  };
};

export async function criarCobranca(params: {
  code: string;
  cliente: ClienteCobranca;
  descricao: string;
  valorCentavos: number;
  vencimento: string;           // YYYY-MM-DD
  multaCentavos?: number;
  jurosPercentualMes?: number;
  descontoPercentual?: number;
  formas: string[];
  idempotencia: string;
  ambiente?: string;
}) {
  const payment_terms: Record<string, unknown> = { due_date: params.vencimento };
  // Só manda o que foi configurado. Um `fine: {amount: 0}` não é o mesmo que
  // ausência de multa para a API.
  if (params.multaCentavos) payment_terms.fine = { amount: params.multaCentavos };
  if (params.jurosPercentualMes) payment_terms.interest = { rate: params.jurosPercentualMes };
  if (params.descontoPercentual) {
    payment_terms.discount = { type: "PERCENT", value: params.descontoPercentual };
  }

  const { dados } = await chamar("POST", "/v2/invoices/", {
    idempotencia: params.idempotencia,
    ambiente: params.ambiente,
    corpo: {
      code: params.code,
      customer: params.cliente,
      services: [{
        name: params.descricao.slice(0, 100),
        description: params.descricao.slice(0, 250),
        amount: params.valorCentavos,
      }],
      payment_terms,
      payment_forms: params.formas,
    },
  });
  return dados as Record<string, unknown>;
}

export async function consultarCobranca(id: string, ambiente?: string) {
  const { dados } = await chamar("GET", `/v2/invoices/${id}`, { ambiente });
  return dados as Record<string, unknown>;
}

// Devolve 'cancelada' | 'ja_paga'. Boleto pago não cancela, e a Cora responde
// 422 com REC-0006 — isso é um ESTADO, não uma falha, e o chamador precisa
// conseguir distinguir para reconciliar em vez de mostrar erro.
export async function cancelarCobranca(
  id: string,
  ambiente?: string,
): Promise<"cancelada" | "ja_paga"> {
  try {
    await chamar("DELETE", `/v2/invoices/${id}`, { ambiente });
    return "cancelada";
  } catch (e) {
    const d = (e as ErroCora).detalhe ?? "";
    if (/REC-0006/.test(d) || /HTTP 422/.test(d)) return "ja_paga";
    throw e;
  }
}

export async function registrarWebhook(
  url: string,
  idempotencia: string,
  ambiente?: string,
) {
  const { dados } = await chamar("POST", "/endpoints", {
    idempotencia,
    ambiente,
    // trigger '*' cobre created, paid, canceled e overdue de uma vez. Um
    // endpoint por evento multiplicaria o cadastro sem ganho: o handler já
    // decide o que fazer pelo header webhook-event-type.
    corpo: { url, resource: "invoice", trigger: "*" },
  });
  return dados as Record<string, unknown>;
}

// ─── Tradução de status ──────────────────────
// O nosso enum é uma TRADUÇÃO do da Cora, não um espelho. A string crua fica
// em payment_charges.provider_status: se a Cora inventar um estado novo, ele
// cai lá e não estoura o CHECK.
export function traduzStatus(coraStatus: string): string {
  switch ((coraStatus || "").toUpperCase()) {
    case "PAID":         return "paga";
    case "CANCELLED":
    case "CANCELED":     return "cancelada";
    case "LATE":         return "vencida";
    case "IN_PAYMENT":   return "em_pagamento";
    case "OPEN":
    case "INITIATED":    return "aberta";
    case "DRAFT":
    case "RECURRENCE_DRAFT": return "rascunho";
    default:             return "aberta";
  }
}

// Extrai boleto e Pix da resposta, que muda de forma conforme as formas de
// pagamento pedidas.
export function extrairPagamento(inv: Record<string, unknown>) {
  const opts = (inv.payment_options ?? {}) as Record<string, unknown>;
  const slip = (opts.bank_slip ?? {}) as Record<string, unknown>;
  const pix = (inv.pix ?? {}) as Record<string, unknown>;
  return {
    boleto_barcode: (slip.barcode as string) ?? null,
    boleto_digitable: (slip.digitable as string) ?? null,
    boleto_url: (slip.url as string) ?? null,
    pix_emv: (pix.emv as string) ?? null,
  };
}
