# Testes end-to-end

Roteiros de Playwright que abrem o ERP num navegador de verdade, navegam
pelas telas e executam as ações principais. Servem para rodar depois de cada
deploy e pegar o que passa despercebido — foi assim que apareceu o bug do
`uploaded_by`, que fazia todo anexo de arte ser descartado silenciosamente.

## Instalação

```bash
cd e2e
npm init -y
npm i playwright
npx playwright install chromium
```

## Credenciais

Não ficam no repositório. Use um usuário **descartável**, nunca o seu:

```bash
export E2E_EMAIL="teste@sejacreate.com.br"
export E2E_PASS="..."
export E2E_URL="http://app.sejacreate.com.br/"   # opcional
```

No PowerShell:

```powershell
$env:E2E_EMAIL="teste@sejacreate.com.br"
$env:E2E_PASS="..."
```

## Os roteiros

### `smoke.js` — seguro, só leitura

Faz login, passa pelas 13 telas, tira screenshot de cada uma e junta os erros
de console/JS. **Não escreve nada.** É o que rodar sempre.

```bash
node smoke.js
```

Falha se alguma tela vier vazia ou se aparecer erro de JS. Screenshots em
`e2e/shots/`.

### `writes.js` — escreve em produção

Cria um card `ZZ TESTE AUTOMATIZADO`, sobe 2 imagens, mexe em checklist, tag,
briefing (editor de duplo clique), data, arrasta entre colunas, abre o popup
do dia no calendário e **apaga o card no fim**.

```bash
node writes.js
```

Dois cuidados embutidos:

- **não move o card para `Programado`, `Enviado ao Cliente` nem `Aprovado`** —
  essas etapas disparam WhatsApp e Área do Cliente, e mandariam mensagem para
  cliente de verdade
- verifica que o anexo **sobrevive a um reload**, não só que apareceu na tela.
  Era exatamente aí que o bug do `uploaded_by` se escondia

Se o script abortar no meio, o card de teste fica no board — confira e apague.

### `orfaos.js` — diagnóstico

Compara as pastas de `tasks/` no bucket `task-arts` com as tarefas que ainda
existem, e lista os arquivos sem card correspondente.

```bash
node orfaos.js            # só relata
LIMPA=1 node orfaos.js    # apaga os órfãos — confira a lista antes
```

## Ordem sugerida após um deploy

```bash
node smoke.js     # 30s, risco zero
node writes.js    # ~2min, cria e apaga um card
```
