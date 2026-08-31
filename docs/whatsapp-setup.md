# Aprovação de Conteúdo via WhatsApp — Guia de Configuração

Permite enviar um conteúdo para o cliente pelo WhatsApp e ele **aprovar ou pedir ajuste
dentro da própria conversa**. A aprovação pelo site (área do cliente) continua funcionando
normalmente — esta é uma opção a mais.

## Visão geral

```
ERP → Edge Function wa-send → WhatsApp Cloud API → Cliente
                                                      │ toca Aprovar / Solicitar Ajuste
Meta → Edge Function wa-webhook → Supabase (tasks + approvals atualizados)
```

## 1. Pré-requisitos na Meta (feito 1x)

1. **Meta Business Manager**: https://business.facebook.com
2. **App** em https://developers.facebook.com → adicione o produto **WhatsApp**.
3. Anote:
   - **Phone Number ID** (Número de telefone do WhatsApp).
   - **Token permanente**: crie um *System User* em Business Settings com a permissão
     `whatsapp_business_messaging` e gere um token sem expiração.
4. **Template de mensagem** (WhatsApp Manager → Modelos de mensagem):
   - Nome: `aprovacao_conteudo` (ou outro — ajuste `WHATSAPP_TEMPLATE_NAME`).
   - Idioma: Português (BR) → `pt_BR`.
   - Categoria: **Utility** (Utilidade).
   - **Cabeçalho**: tipo **Imagem**.
   - **Corpo** (com 3 variáveis):
     ```
     Olá {{1}}! Temos um novo conteúdo para sua aprovação: *{{2}}*.

     {{3}}

     Toque em um botão abaixo.
     ```
   - **Botões → Resposta rápida** (2 botões):
     - `✅ Aprovar`
     - `🔄 Solicitar Ajuste`
   - Envie para aprovação da Meta (pode levar de minutos a alguns dias).

## 2. Banco de dados

Rode no **Supabase SQL Editor** o arquivo:

- [`supabase-migration-006.sql`](../supabase-migration-006.sql) — cria a tabela
  `whatsapp_dispatches` (mapeia cada envio à tarefa e guarda o estado da conversa).

## 3. Storage / Arte pública

O cabeçalho de imagem do template exige uma **URL pública**. As artes enviadas pelo ERP
já vão para o Supabase Storage com URL pública (`art_url`). Garanta que o bucket usado é
**público** (ou tem política de leitura pública). Sem `art_url`, o envio é bloqueado com
aviso no ERP.

## 4. Deploy das Edge Functions

Instale a [Supabase CLI](https://supabase.com/docs/guides/cli) e, na raiz do projeto:

```bash
supabase login
supabase link --project-ref owauukcjdasumguvzqch

# Secrets (NUNCA versionar estes valores)
supabase secrets set \
  WHATSAPP_TOKEN="EAAB...seu_token_permanente" \
  PHONE_NUMBER_ID="123456789012345" \
  WEBHOOK_VERIFY_TOKEN="uma_frase_secreta_qualquer" \
  WHATSAPP_TEMPLATE_NAME="aprovacao_conteudo" \
  WHATSAPP_TEMPLATE_LANG="pt_BR"
# SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das functions.

supabase functions deploy wa-send
supabase functions deploy wa-webhook
```

URLs resultantes:
- `wa-send`    → `https://owauukcjdasumguvzqch.supabase.co/functions/v1/wa-send`
- `wa-webhook` → `https://owauukcjdasumguvzqch.supabase.co/functions/v1/wa-webhook`

## 5. Configurar o Webhook na Meta

Em developers.facebook.com → seu App → WhatsApp → Configuration → Webhook:

- **Callback URL**: a URL do `wa-webhook` acima.
- **Verify token**: o mesmo valor de `WEBHOOK_VERIFY_TOKEN`.
- Após verificar, **assine (subscribe)** o campo **`messages`**.

## 6. Teste end-to-end

1. No ERP, abra um card que tenha **arte enviada** e cujo **cliente tenha telefone**.
2. Clique em **“Enviar p/ aprovação (WhatsApp)”** (botão verde).
3. No WhatsApp do cliente deve chegar a arte + texto + 2 botões.
4. Toque **✅ Aprovar** → o card vira **Aprovado** no ERP, com registro em `approvals`.
5. Em outro card, toque **🔄 Solicitar Ajuste** → o bot pede o motivo; o cliente digita;
   o card vira **Ajuste Solicitado** com o motivo salvo em `approvals.feedback`.

### Depuração

```bash
supabase functions logs wa-webhook
supabase functions logs wa-send
```

Pontos comuns:
- **Template não aprovado / nome errado** → erro `whatsapp_send_failed` no ERP.
- **Arte sem URL pública** → a Meta rejeita o header de imagem.
- **Telefone sem DDI** → o helper assume Brasil (55); confira números internacionais.
- **24h**: respostas livres da empresa só valem dentro de 24h após a última mensagem do
  cliente — o fluxo só responde após um toque/mensagem dele, então respeita a janela.

## Custos

Conversas iniciadas pela empresa (template) têm **custo por conversa** na Cloud API
(tarifa de *Utility* no Brasil). Consulte a tabela de preços da Meta.
