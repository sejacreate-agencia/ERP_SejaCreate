# scripts/

## `stamp-assets.js` — cache busting

O GitHub Pages serve tudo com `Cache-Control: max-age=600`. Ao dar F5 o
navegador revalida o `index.html` (que tem ETag) e recebe o HTML novo, mas os
`.js` ainda dentro dos 10 minutos ele **reusa do cache sem revalidar**. O
resultado é a página nova rodando código velho — e a impressão de que o deploy
falhou.

Este script carimba `?v=<hash>` em cada `js/*` e `css/*` referenciado no
`index.html`. Como o HTML novo aponta para URLs novas, o navegador é obrigado a
buscar. O hash sai do **conteúdo do arquivo**, então só muda o que realmente
mudou — o resto continua vindo do cache, como deve.

```bash
node scripts/stamp-assets.js          # carimba
node scripts/stamp-assets.js --check  # só verifica; sai 1 se desatualizado
```

**Rode antes de commitar qualquer alteração em `js/` ou `css/`.**

### Automatizar

Uma vez por clone:

```bash
git config core.hooksPath .githooks
```

A partir daí o `pre-commit` recarimba sozinho sempre que um arquivo de `js/` ou
`css/` entra no commit.
