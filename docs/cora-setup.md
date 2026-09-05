# Integração com a Cora — configuração

Cobrança por boleto registrado com QR Code Pix, e baixa automática do
recebimento quando o cliente paga.

> **Estado atual: Fase 1 (spike).** Só existe a função `cora-spike`, que
> responde uma pergunta técnica. Nada de cobrança foi construído ainda — e de
> propósito: o resultado do spike decide onde o código vai morar.

---

## Por que existe um spike antes de tudo

A Cora tem dois modelos de integração:

| modelo | para quem | como autentica |
|---|---|---|
| **Cora Partnership** | empresas que oferecem a Cora aos *seus* clientes | OAuth com `client_id` + `client_secret` |
| **Integração Direta** | quem usa a API na própria conta | **certificado de cliente (mTLS)** |

A Seja Create usa a própria conta, então é **Integração Direta** — e ela não tem
`client_secret`. A autenticação acontece na camada TLS: o servidor apresenta um
certificado e uma chave privada ao conectar em
`matls-clients.api.cora.com.br`.

O ERP roda em Supabase Edge Functions (Deno). A única forma de apresentar
certificado de cliente ali é `Deno.createHttpClient({ cert, key })`, que **não
consta da documentação do Supabase como suportada**. Se não funcionar, o `fetch`
falha no handshake e nenhuma linha do resto do projeto serve.

O mesmo vale para a NFS-e: o Sefin Nacional também exige mTLS, com o e-CNPJ A1.
**As duas integrações do roadmap dependem desta resposta.**

Por isso a Fase 1 é uma função de 170 linhas que só tenta pegar um token no
ambiente de testes. Custa um deploy e evita descobrir o problema no meio da
implementação.

---

## 1. Obter as credenciais (Stage)

No painel da Cora: **Conta → Integrações via APIs → Integração Direta**.

Você recebe três coisas:

- `certificate.pem` — o certificado
- `private-key.key` — a chave privada
- o **`client_id`**

Comece pelo **Stage**. Certificado de stage não funciona em produção e
vice-versa — são pares distintos.

> Guarde os dois arquivos fora do repositório. O `.gitignore` já bloqueia
> `*.pem` e `*.key`, mas o repositório inteiro — incluindo `supabase/` — é
> publicado no GitHub Pages, então um arquivo de credencial commitado fica
> público na hora.

---

## 2. Configurar os segredos

Os PEM vão em **base64**: quebra de linha dentro de variável de ambiente é fonte
garantida de erro silencioso.

```bash
supabase login
supabase link --project-ref owauukcjdasumguvzqch

supabase secrets set CORA_AMBIENTE=stage
supabase secrets set CORA_CLIENT_ID='<o client_id da Cora>'
supabase secrets set CORA_CERT_B64="$(base64 -w0 certificate.pem)"
supabase secrets set CORA_KEY_B64="$(base64 -w0 private-key.key)"
```

No Windows, use o **Git Bash** — o `base64 -w0` vem com ele. No PowerShell o
equivalente é:

```powershell
$cert = [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pem"))
supabase secrets set CORA_CERT_B64="$cert"
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das
functions — não precisa defini-los.

---

## 3. Publicar e rodar o spike

```bash
supabase functions deploy cora-spike
```

Entre no ERP **como administrador** (o spike recusa outros perfis: ele expõe
detalhes de infraestrutura). Abra o console do navegador — F12 → Console — e
rode:

```js
(await supabaseClient.functions.invoke('cora-spike')).data
```

---

## 4. Como ler o resultado

### Funcionou

```json
{
  "tem_api": true,
  "assinatura": "cert/key",
  "http_status": 200,
  "tem_token": true,
  "expires_in": 86400
}
```

`tem_token: true` é o que importa. Significa que o Supabase consegue fazer mTLS
e **todo o resto do projeto — Cora e NFS-e — fica dentro do Supabase**, sem
peça nova na stack. Pode seguir para a Fase 2.

O `access_token` nunca é devolvido: esta resposta chega ao navegador.

### Não funcionou

| resposta | o que significa | o que fazer |
|---|---|---|
| `tem_api: false` | `Deno.createHttpClient` não existe neste runtime | Não há mTLS aqui. Vai para o proxy externo |
| `assinatura: null` | a API existe mas recusou as duas formas de passar o certificado | Idem |
| `erro: "fetch falhou: ..."` | o handshake TLS não fechou | Confira se o certificado é o de **stage**; se for, é limitação do runtime |
| `http_status: 401` | o mTLS **funcionou** — o servidor respondeu | Confira o `client_id`. Isto é boa notícia: a conexão fechou |
| `tem_secrets` com `false` | falta rodar algum `secrets set` do passo 2 | — |

**O plano B já está definido:** um Cloudflare Worker com binding de certificado
mTLS (`wrangler mtls-certificate upload`), atuando como proxy burro. As tabelas,
as telas e a lógica não mudam — muda só onde o `fetch` acontece. Avise o
resultado e eu sigo por esse caminho.

---

## 5. Depois do spike

```bash
supabase functions delete cora-spike
```

E remova o bloco `[functions.cora-spike]` do `supabase/config.toml`. A função é
descartável: existe para responder uma pergunta, não para ficar.

---

## Referências

- Documentação da Cora: <https://developers.cora.com.br/>
- Instruções iniciais e URLs por ambiente:
  <https://developers.cora.com.br/docs/instrucoes-iniciais>
- Client Credentials na Integração Direta:
  <https://developers.cora.com.br/docs/client-credentials-int-direta>
- Suporte da API: suporteapi@cora.com.br

## Ambientes

| | Integração Direta |
|---|---|
| Stage | `https://matls-clients.api.stage.cora.com.br` |
| Produção | `https://matls-clients.api.cora.com.br` |

Valores na API da Cora são **inteiros em centavos**: R$ 10,01 é `1001`.
