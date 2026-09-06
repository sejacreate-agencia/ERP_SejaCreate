// =============================================
// SPIKE — mTLS funciona nas Edge Functions?
// =============================================
// FUNÇÃO TEMPORÁRIA. Apagar assim que a resposta estiver registrada.
//
// A Integração Direta da Cora não usa client_secret: ela exige um certificado
// de cliente na própria conexão TLS (mTLS), contra
// matls-clients.api.cora.com.br. O Sefin Nacional da NFS-e exige o mesmo, com o
// e-CNPJ A1. Ou seja: as DUAS integrações do roadmap dependem de conseguir
// apresentar um certificado de cliente a partir daqui.
//
// O Edge Runtime do Supabase é um fork do Deno, e `Deno.createHttpClient` é a
// única porta para isso. Ela não consta da documentação do Supabase como
// suportada, e relatos na comunidade se contradizem. Em vez de descobrir isso
// no meio da implementação, esta função responde à pergunta em um deploy.
//
// O resultado decide a arquitetura:
//   tem_token: true  → tudo continua dentro do Supabase.
//   tem_token: false → entra um proxy mTLS externo (Cloudflare Worker com
//                      binding de certificado, ou um serviço pequeno em
//                      Deno Deploy/Fly). As tabelas e as telas não mudam;
//                      muda só onde o fetch acontece.
//
// Chamada, com um usuário admin logado no ERP:
//   supabaseClient.functions.invoke('cora-spike')

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  CLIENT_ID: Deno.env.get("CORA_CLIENT_ID") ?? "",
  CERT_B64: Deno.env.get("CORA_CERT_B64") ?? "",
  KEY_B64: Deno.env.get("CORA_KEY_B64") ?? "",
  AMBIENTE: Deno.env.get("CORA_AMBIENTE") ?? "stage",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const baseUrl = () =>
  ENV.AMBIENTE === "producao"
    ? "https://matls-clients.api.cora.com.br"
    : "https://matls-clients.api.stage.cora.com.br";

// Os PEM vão em base64 nos secrets: quebra de linha em variável de ambiente é
// fonte garantida de erro silencioso.
const doB64 = (s: string) => new TextDecoder().decode(
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // verify_jwt = true já barrou quem não está logado; aqui só confirmamos que
  // quem chama é admin — o spike expõe detalhes da infra.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  const db = createClient(ENV.SUPABASE_URL, ENV.SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u } = await db.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user?.id) return json({ error: "unauthorized" }, 401);
  const { data: perfil } = await db
    .from("profiles").select("role").eq("id", u.user.id).single();
  if (perfil?.role !== "admin") return json({ error: "somente_admin" }, 403);

  const r: Record<string, unknown> = {
    ambiente: ENV.AMBIENTE,
    base_url: baseUrl(),
    deno_version: Deno.version?.deno ?? null,
    tem_api: typeof (Deno as { createHttpClient?: unknown }).createHttpClient
      === "function",
    tem_secrets: {
      client_id: !!ENV.CLIENT_ID,
      cert: !!ENV.CERT_B64,
      key: !!ENV.KEY_B64,
    },
    assinatura: null,
    http_status: null,
    tem_token: false,
    expires_in: null,
    erro: null,
  };

  if (!r.tem_api) {
    r.erro = "Deno.createHttpClient não existe neste runtime. "
      + "Sem ela não há mTLS: use um proxy externo.";
    return json(r);
  }
  if (!ENV.CLIENT_ID || !ENV.CERT_B64 || !ENV.KEY_B64) {
    r.erro = "Faltam secrets. Rode os `supabase secrets set` de docs/cora-setup.md.";
    return json(r);
  }

  let cert: string, key: string;
  try {
    cert = doB64(ENV.CERT_B64);
    key = doB64(ENV.KEY_B64);
  } catch (e) {
    r.erro = `CORA_CERT_B64/CORA_KEY_B64 não são base64 válido: ${(e as Error).message}`;
    return json(r);
  }
  if (!cert.includes("BEGIN CERTIFICATE")) {
    r.erro = "CORA_CERT_B64 não contém um PEM de certificado.";
    return json(r);
  }
  if (!/BEGIN (RSA )?PRIVATE KEY/.test(key)) {
    r.erro = "CORA_KEY_B64 não contém um PEM de chave privada.";
    return json(r);
  }

  // O nome das opções mudou entre versões do Deno. Testar só uma forma leva a
  // um falso negativo — daí as duas tentativas.
  const criar = (Deno as unknown as {
    createHttpClient: (o: Record<string, string>) => unknown;
  }).createHttpClient;

  let client: unknown = null;
  for (
    const [nome, opts] of [
      ["cert/key", { cert, key }],
      ["certChain/privateKey", { certChain: cert, privateKey: key }],
    ] as const
  ) {
    try {
      client = criar(opts as Record<string, string>);
      r.assinatura = nome;
      r.erro = null;   // a primeira forma pode ter falhado; deu certo na segunda
      break;
    } catch (e) {
      r.erro = `${nome}: ${(e as Error).message}`;
    }
  }
  if (!client) {
    r.erro = `Nenhuma assinatura aceita. Último erro — ${r.erro}`;
    return json(r);
  }

  try {
    const resp = await fetch(`${baseUrl()}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: ENV.CLIENT_ID,
      }),
      // @ts-ignore: `client` é extensão do Deno, não faz parte do fetch padrão
      client,
    });
    r.http_status = resp.status;
    const texto = await resp.text();
    if (resp.ok) {
      const j = JSON.parse(texto);
      // NUNCA devolver o access_token: esta resposta chega ao navegador.
      r.tem_token = !!j.access_token;
      r.expires_in = j.expires_in ?? null;
      r.token_type = j.token_type ?? null;
      r.scope = j.scope ?? null;
    } else {
      r.erro = `HTTP ${resp.status}: ${texto.slice(0, 300)}`;
    }
  } catch (e) {
    r.erro = `fetch falhou: ${(e as Error).message}`;
  } finally {
    try {
      (client as { close?: () => void }).close?.();
    } catch { /* nada a fazer */ }
  }

  return json(r);
});
