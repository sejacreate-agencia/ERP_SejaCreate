# Google Agenda — configuração

Integração que mostra os compromissos do dia na aba **Agenda** e permite criar
novos por ditado.

```
ERP (navegador)            Edge Function 'gcal'              Google
     |  invoke({acao:'listar'})    |                            |
     |---------------------------->|                            |
     |                      assina um JWT com a chave            |
     |                      da conta de servico                  |
     |                             |------- troca por token ---->|
     |                             |<------ eventos -------------|
     |<----------------------------|                            |
```

## Por que conta de serviço e não "Conectar com o Google"

Com contas `@gmail.com` (sem Google Workspace), um app OAuth em modo *Testing*
tem os **refresh tokens revogados a cada 7 dias** — a equipe inteira precisaria
reconectar toda semana. Escapar disso exigiria passar pela verificação do
Google: política de privacidade publicada, comprovação de domínio, vídeo
demonstrando o uso do escopo, e semanas de espera.

A conta de serviço não tem esse problema. Ela não expira, não pede tela de
consentimento e não passa por verificação. O custo é um passo manual: **cada
pessoa compartilha a própria agenda uma vez**.

A conta de serviço não enxerga nada por conta própria — só as agendas que forem
explicitamente compartilhadas com o e-mail dela.

---

## 1. Google Cloud (uma vez, feito por você)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie um
   projeto (ou use um existente).
2. **APIs e serviços → Biblioteca** → procure **Google Calendar API** → **Ativar**.
3. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   - Nome: `erp-agenda` (ou o que preferir)
   - Não é preciso conceder papel nenhum no projeto — ela não acessa recursos do
     Google Cloud, só as agendas compartilhadas com ela.
4. Abra a conta de serviço criada → aba **Chaves** → **Adicionar chave → Criar
   nova chave → JSON**. O arquivo baixa automaticamente.
5. Anote o **e-mail da conta de serviço** — algo como
   `erp-agenda@seu-projeto.iam.gserviceaccount.com`. É ele que a equipe vai usar
   no passo 4.

> **Não versione o JSON.** O repositório inteiro, incluindo `supabase/`, é
> publicado no GitHub Pages.

## 2. Banco

Rode [`supabase-migration-019.sql`](../supabase-migration-019.sql) no SQL Editor
do Supabase. Ela cria a tabela `google_calendars`, que guarda apenas **qual
agenda pertence a cada usuário** — nenhum segredo.

## 3. Publicar a Edge Function

No JSON baixado há dois campos que interessam: `client_email` e `private_key`.

```bash
supabase login
supabase link --project-ref owauukcjdasumguvzqch

# A chave privada tem quebras de linha. Guarde com \n ESCAPADO — é o formato
# que sobrevive ao secrets set; a function desescapa ao ler.
# Para gerar o valor já escapado a partir do JSON:
#   node -e "console.log(JSON.parse(require('fs').readFileSync('chave.json','utf8')).private_key.replace(/\n/g,'\\\\n'))"

supabase secrets set \
  GOOGLE_SA_EMAIL="erp-agenda@seu-projeto.iam.gserviceaccount.com" \
  GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n" \
  APP_TIMEZONE="America/Sao_Paulo"

supabase functions deploy gcal
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das
functions — não precisa defini-los.

## 4. Cada pessoa conecta a própria agenda

Este é o único passo que cada membro da equipe faz, uma vez:

**No Google Agenda (pelo computador):**

1. Passe o mouse sobre a sua agenda na lista da esquerda → **⋮ → Configurações e
   compartilhamento**
2. Role até **Compartilhar com pessoas ou grupos específicos** → **Adicionar
   pessoas**
3. Cole o e-mail da conta de serviço
4. Em permissões, escolha **Fazer alterações nos eventos**
5. **Enviar**

**No ERP:**

6. **Configurações → Integrações**, no card **Google Agenda**
7. O e-mail da conta de serviço aparece ali com um botão de copiar — use-o no
   passo 3 se ainda não tiver copiado
8. Informe o e-mail da sua agenda (normalmente o seu próprio e-mail do Google) e
   clique em **Verificar acesso**

O botão testa o acesso de verdade **antes** de salvar. Se aparecer *"a conta de
serviço não tem acesso a essa agenda"*, o compartilhamento do passo 4 não foi
concluído ou foi feito em outra agenda.

## 5. Usando

Na aba **Agenda**:

- os compromissos do dia aparecem abaixo das tarefas
- o botão **Ditar** abre o campo de novo compromisso

Para ditar no iPhone: toque no campo, aperte o **microfone do teclado** e fale.
Ex.: *"reunião com a Luanna terça às 15h"*. O ERP interpreta data, hora e
cliente, e abre um formulário de confirmação — nada vai para a agenda sem você
revisar.

> O app **não grava áudio**. Quem transcreve é o próprio iOS, pelo teclado.
> Num PWA aberto pela tela de início, o iOS quebra tanto o
> `webkitSpeechRecognition` quanto o `MediaRecorder` (ambos documentados no
> fórum da Apple), então gravar dentro do app seria pouco confiável.

Campos que o interpretador entende:

| Você fala | Vira |
|---|---|
| hoje, amanhã, depois de amanhã | a data correspondente |
| terça, sexta-feira | a próxima ocorrência |
| terça que vem | a ocorrência da semana seguinte |
| dia 15 | dia 15 deste mês, ou do próximo se já passou |
| 05/09, 12 de setembro | a data exata |
| às 15h, 15h30, 15:30, meio dia | o horário |
| 3 da tarde | 15:00 |
| o nome ou o contato de um cliente | o cliente vinculado |

Sem data ou hora ditadas, ele sugere hoje às 09:00 e **destaca o campo em
amarelo** para você conferir. A duração padrão é 1 hora.

## Depuração

```bash
supabase functions logs gcal
```

| Sintoma | Causa provável |
|---|---|
| "Integração não configurada no servidor" | faltam os secrets, ou a função não foi publicada |
| "Falha ao autenticar no Google" | `GOOGLE_SA_PRIVATE_KEY` com `\n` errado — é o erro mais comum |
| "A conta de serviço não tem acesso a essa agenda" | o passo 4 não foi concluído, ou foi noutra agenda |
| Evento aparece 3 horas fora | `APP_TIMEZONE` errado |

## Custos

Nenhum. A Google Calendar API é gratuita nos volumes de uma agência (limite
padrão de 1.000.000 de requisições por dia).
