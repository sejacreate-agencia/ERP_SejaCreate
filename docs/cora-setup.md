# Integração com a Cora — configuração

Cobrança por boleto registrado com QR Code Pix, e baixa automática do
recebimento quando o cliente paga.

---

## Qual modelo usamos, e por quê

A Cora tem dois:

| modelo | credencial | roda nas Edge Functions? |
|---|---|---|
| **Parceria Cora** | `client_id` + `client_secret` (OAuth2) | **sim** |
| Integração Direta | certificado + chave privada (mTLS) | incerto |

Usamos a **Parceria**. A Integração Direta autentica na camada TLS, e a única
porta para isso no Edge Runtime do Supabase é `Deno.createHttpClient`, que a
documentação do Supabase não lista como suportada. Se não funcionasse, seria
preciso um proxy externo — um Cloudflare Worker com binding de certificado, que
é recurso pago — só para intermediar.

O OAuth funciona hoje e reaproveita o desenho já provado do Google Agenda:
função de start autenticada, callback público, `state` de uso único e refresh de
token no servidor.

> A função `cora-spike` continua no repositório. Ela responde se o mTLS funciona
> aqui, e **essa pergunta volta na fase da NFS-e**: o Sefin Nacional exige mTLS
> com o e-CNPJ A1. Não apague.

---

## 1. Pedir a Parceria

No painel da Cora: **Conta → Integrações via APIs → Parceria Cora → Solicitar
integração**. Aceite os termos.

Vai ser pedido um **link de redirecionamento**. É este, exatamente:

```
https://owauukcjdasumguvzqch.supabase.co/functions/v1/cora-oauth-callback
```

Um só. É o endereço da Edge Function que recebe o `code` e o troca pelos tokens,
no servidor.

**Por que não `app.sejacreate.com.br`:** o `js/supabase.js` roda com
`detectSessionInUrl: true`, e o `supabase-js` inspeciona a URL no boot
procurando `?code=` — o dele, do PKCE. Um código da Cora ali seria confundido
com um login. Foi por isso que o callback do Google também aponta para uma Edge
Function.

A Cora responde em até **3 dias úteis** e devolve `client_id` e `client_secret`.

---

## 2. Configurar os segredos

```bash
supabase login
supabase link --project-ref owauukcjdasumguvzqch

supabase secrets set CORA_AMBIENTE=stage
supabase secrets set CORA_CLIENT_ID='<client_id>'
supabase secrets set CORA_CLIENT_SECRET='<client_secret>'
supabase secrets set CORA_WEBHOOK_TOKEN="$(openssl rand -hex 32)"
```

No Windows use o **Git Bash** (o `openssl` vem com ele). Sem openssl, serve
qualquer string longa e aleatória.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `APP_URL` já existem no ambiente
das functions — não defina.

**Nunca** mande `client_secret` por chat, e-mail ou commit. O repositório
inteiro, incluindo `supabase/`, é publicado no GitHub Pages.

---

## 3. Publicar

```bash
supabase functions deploy cora
supabase functions deploy cora-oauth-start
supabase functions deploy cora-oauth-callback
supabase functions deploy cora-webhook
```

E as migrations, se ainda não rodou: **022** a **027** no SQL Editor, em ordem.

---

## 4. Conectar

1. Entre no ERP **como administrador**.
2. **Integrações → Cora**.
3. **Conectar Cora** → você vai para a Cora, autoriza, e volta.
4. **Registrar webhook** — sem isso a baixa não é automática; só o botão
   Sincronizar concilia.
5. **Testar conexão** deve responder ✅.

O cartão passa a mostrar ambiente, conta, data da conexão e o estado do webhook.

---

## 5. Roteiro de teste no Stage

Faça na ordem. Cada passo tem um resultado esperado.

| # | faça | espere |
|---|---|---|
| 1 | Crie um recebimento de **R$ 1,00** com vencimento hoje e clique em **Gerar** na coluna Cobrança / NF | Modal com cliente, valor e vencimento travados |
| 2 | **Gerar cobrança** | Linha digitável e Pix copia e cola na tela |
| 3 | Clique **Gerar** de novo, rápido, duas vezes | A segunda diz "já possui uma cobrança" — a trava é o índice `uniq_charge_viva_por_recebivel`, não a tela |
| 4 | Gere para um cliente **sem CPF/CNPJ ou sem endereço** | Recusa listando **nominalmente** o que falta |
| 5 | Pague o boleto no Stage | Em menos de 1 min o recebimento vira **Pago**, com valor e forma preenchidos |
| 6 | Pague **a menor** | Vira **Parcial**, e o saldo continua no card "A Receber" |
| 7 | Tente cancelar uma cobrança já paga | "já foi paga — acabei de conciliá-la". Não é erro: é estado |
| 8 | Edite um cliente que tenha mensalidade com boleto | As parcelas com cobrança são **preservadas** |
| 9 | Exclua um recebimento com cobrança ativa | Recusa pedindo para cancelar a cobrança antes |

### Testar o webhook por fora

```bash
URL="https://owauukcjdasumguvzqch.supabase.co/functions/v1/cora-webhook/$CORA_WEBHOOK_TOKEN"
H=(-H "webhook-event-id: evt_t1" -H "webhook-event-type: invoice.paid" \
   -H "webhook-resource-id: inv_XXXX")

curl -X POST "$URL" "${H[@]}" -d ''     # 1a vez: {"ok":true,...}
curl -X POST "$URL" "${H[@]}" -d ''     # 2a: {"duplicado":true} e NADA muda
curl -X POST ".../cora-webhook/errado" "${H[@]}" -d ''   # 404
```

O terceiro caso responde **404, não 403**: confirmar que o endpoint existe já
seria informação demais.

---

## 6. Ir para produção

1. Peça as credenciais de **produção** no painel.
2. `supabase secrets set CORA_AMBIENTE=producao CORA_CLIENT_ID=... CORA_CLIENT_SECRET=...`
3. Reconecte em **Integrações → Cora** (a autorização é por ambiente).
4. Registre o webhook de novo.

---

## Como funciona por dentro

```
A Receber ──► cora:emitir ──► POST /v2/invoices/ ──► boleto + Pix
                                                        │
                              cliente paga ─────────────┘
                                    │
                    Cora ──► cora-webhook (corpo VAZIO, sem assinatura)
                                    │
                    GET /v2/invoices/{id}  ← a verdade vem DAQUI
                                    │
                    RPC cora_liquidar_cobranca (uma transação)
                                    │
                      recebimento vira Pago / Parcial
```

Três decisões que valem conhecer:

**A notificação nunca é fonte de verdade.** Ela chega com corpo vazio e sem
HMAC. Não há o que validar, então é tratada como "algo mudou" e a verdade vem do
`GET` que nós fazemos. Quem forjar uma notificação consegue, no máximo, nos
fazer consultar a nossa própria API.

**A chave de idempotência é gravada antes da chamada.** Se nascesse no momento
do `fetch`, um duplo-clique ou um retry após timeout registraria dois boletos no
banco do cliente.

**Valor e vencimento vêm do banco, não do navegador.** O front manda só o
`receivable_id`. Um valor vindo do browser seria emissão de boleto com valor
arbitrário por qualquer pessoa logada.

---

## Quando algo dá errado

| sintoma | causa provável |
|---|---|
| "ainda não foi configurada" | faltam os `secrets` do passo 2 |
| "Conecte a conta da Cora" | ninguém completou o passo 4 |
| "A conexão expirou" | 60 dias sem uso, ou autorização revogada na Cora. Reconecte |
| Pagou e não baixou | webhook não registrado, ou **Baixar automaticamente** desligado. Use **Sincronizar** |
| Cobranças param de gerar | veja o **último erro** no cartão, e `supabase functions logs cora` |

**A sessão expira com 60 dias de inatividade.** A tela avisa a partir de 45 dias.

O histórico de webhooks fica em `provider_webhook_events`, que é deny-all no
banco — a única leitura é a ação `eventos` da função `cora`.

---

## Referências

- <https://developers.cora.com.br/>
- [Fluxos de autorização](https://developers.cora.com.br/docs/fluxos-de-autorizacao-e-autenticacao)
- [Instruções iniciais](https://developers.cora.com.br/docs/instrucoes-iniciais)
- suporteapi@cora.com.br

| ambiente | Parceria (OAuth) |
|---|---|
| Stage | `https://api.stage.cora.com.br` |
| Produção | `https://api.cora.com.br` |

Valores na API são **inteiros em centavos**: R$ 10,01 é `1001`.
