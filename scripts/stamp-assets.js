#!/usr/bin/env node
// Carimba ?v=<hash> nas URLs de js/ e css/ dentro do index.html.
//
// Por que isto existe: o GitHub Pages serve tudo com Cache-Control: max-age=600.
// Ao dar F5 o navegador revalida o index.html (tem ETag) e recebe o HTML novo,
// mas os .js ainda dentro dos 10 minutos ele reusa do cache SEM revalidar. O
// resultado é a página nova carregando o código velho — e a impressão de que o
// deploy falhou.
//
// Com ?v=<hash do arquivo>, o HTML novo aponta para uma URL nova e o navegador
// é obrigado a buscar. O hash vem do CONTEÚDO, então só muda o que realmente
// mudou; o resto continua vindo do cache, como deve.
//
// Uso:
//   node scripts/stamp-assets.js          # carimba
//   node scripts/stamp-assets.js --check  # só verifica (sai 1 se desatualizado)
//
// Rode antes de commitar qualquer alteração em js/ ou css/.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ  = path.join(__dirname, '..');
const HTML  = path.join(RAIZ, 'index.html');
const CHECK = process.argv.includes('--check');

const hashDe = (rel) => {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
};

let html = fs.readFileSync(HTML, 'utf8');
const antes = html;

let carimbados = 0;
const faltando = [];

// src="js/..." e href="css/..." — com ou sem ?v= anterior
html = html.replace(
  /(\s(?:src|href)=")((?:js|css)\/[^"?]+)(\?v=[^"]*)?(")/g,
  (todo, ini, arquivo, _versaoAntiga, fim) => {
    const h = hashDe(arquivo);
    if (!h) { faltando.push(arquivo); return todo; }
    carimbados++;
    return `${ini}${arquivo}?v=${h}${fim}`;
  }
);

if (faltando.length) {
  console.error('Arquivos referenciados no index.html que não existem no disco:');
  faltando.forEach(f => console.error('  ' + f));
  process.exit(2);
}

const mudou = html !== antes;

if (CHECK) {
  if (mudou) {
    console.error('index.html está com hashes desatualizados. Rode: node scripts/stamp-assets.js');
    process.exit(1);
  }
  console.log(`ok — ${carimbados} assets com hash atualizado`);
  process.exit(0);
}

if (mudou) {
  fs.writeFileSync(HTML, html);
  console.log(`index.html atualizado — ${carimbados} assets carimbados`);
} else {
  console.log(`nada a fazer — ${carimbados} assets já estavam com o hash certo`);
}
