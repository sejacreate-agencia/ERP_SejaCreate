// Fase B — testa as acoes que ESCREVEM, confinadas a um card descartavel.
// Evita as etapas que disparam integracao (Programado / Enviado ao Cliente /
// Aprovado), que mandariam WhatsApp ou publicariam para cliente real.
// Ao final apaga o card criado.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL   = process.env.E2E_URL || 'http://app.sejacreate.com.br/';
const EMAIL = process.env.E2E_EMAIL;
const PASS  = process.env.E2E_PASS;
const SHOTS = path.join(__dirname, 'shots');
const TITULO = 'ZZ TESTE AUTOMATIZADO — apagar';

// PNG 4x4 valido, gerado na hora (nao depende de arquivo externo)
const IMG = path.join(__dirname, 'teste.png');
fs.writeFileSync(IMG, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAHElEQVQI12P4//8/AzYEEmDEJgESZ8SlAkMCAFYuD/x9lHqYAAAAAElFTkSuQmCC',
  'base64'));

const r = { passos: [], erros: [] };
const ok   = (p, d = '') => { r.passos.push({ passo: p, status: 'OK', detalhe: d }); console.log('OK   ' + p + (d ? ' — ' + d : '')); };
const falha = (p, d = '') => { r.passos.push({ passo: p, status: 'FALHOU', detalhe: d }); console.log('FALHA ' + p + (d ? ' — ' + d : '')); };

if (!process.env.E2E_EMAIL || !process.env.E2E_PASS) {
  console.error('faltando E2E_EMAIL / E2E_PASS — veja o README');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', e => r.erros.push('js: ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_/.test(m.text())) r.erros.push('console: ' + m.text().slice(0, 200)); });

  // ── LOGIN ──
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-pass', PASS);
  await page.click('.btn-login');
  await page.waitForTimeout(6000);
  if (!await page.locator('#app').isVisible()) { falha('login'); console.log(JSON.stringify(r)); await browser.close(); process.exit(1); }
  ok('login');

  // ── MATRIZ DE PERMISSOES (so leitura, era a tela cortada) ──
  await page.click('[data-page="configuracoes"]'); await page.waitForTimeout(2000);
  await page.click('[data-action="switch-config-section"][data-section="permissoes"]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, 'b-permissoes.png') });
  const btnSalvar = await page.locator('[data-action="save-permissoes"]').boundingBox();
  const larguraJanela = page.viewportSize().width;
  if (btnSalvar && btnSalvar.x + btnSalvar.width <= larguraJanela) ok('matriz de permissoes', 'botao Salvar visivel dentro da tela');
  else falha('matriz de permissoes', 'botao Salvar cortado: ' + JSON.stringify(btnSalvar));

  // ── CRIAR CARD DESCARTAVEL ──
  await page.click('[data-page="tarefas"]'); await page.waitForTimeout(3000);
  const colunas = await page.locator('.kanban-col').count();
  ok('kanban carregou', colunas + ' colunas');

  await page.click('[data-action="open-card-modal"]'); await page.waitForTimeout(1500);
  await page.fill('#nc-title', TITULO);
  await page.selectOption('#nc-client', { index: 1 }).catch(() => {});
  await page.selectOption('#nc-assignee', { index: 1 }).catch(() => {});
  await page.fill('#nc-text', 'Card criado por teste automatizado. Pode apagar.');
  await page.screenshot({ path: path.join(SHOTS, 'b-novo-card.png') });
  await page.click('[data-action="save-new-card"]');
  await page.waitForTimeout(5000);

  const cardNovo = page.locator(`[data-action="open-task-modal"]`).filter({ hasText: 'ZZ TESTE' }).first();
  if (!await cardNovo.count()) { falha('criar card', 'card nao apareceu no board'); console.log(JSON.stringify(r, null, 2)); await browser.close(); process.exit(1); }
  ok('criar card');

  // ── ABRIR O CARD ──
  await cardNovo.click(); await page.waitForTimeout(3000);
  const taskId = await page.locator('[data-action="delete-task"]').getAttribute('data-id');
  ok('abrir card', 'id ' + taskId);

  // ── UPLOAD DE IMAGEM (multiplo) ──
  await page.click('[data-action="upload-art-modal"]'); await page.waitForTimeout(1200);
  await page.setInputFiles('#art-file-input', [IMG, IMG]);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(SHOTS, 'b-upload.png') });
  const statusUp = await page.locator('#upload-status').textContent().catch(() => '');
  if (/enviado/i.test(statusUp || '')) ok('upload de 2 imagens', statusUp.trim());
  else falha('upload de 2 imagens', statusUp || '(sem status)');
  await page.waitForTimeout(3000);

  // reabre o card para ver os anexos
  if (!await page.locator('#modal-overlay').isVisible()) {
    await page.locator(`[data-action="open-task-modal"]`).filter({ hasText: 'ZZ TESTE' }).first().click();
    await page.waitForTimeout(3000);
  }
  // as secoes viraram <details>; abre todas antes de interagir
  await page.locator('#modal-overlay details').evaluateAll(ds => ds.forEach(d => d.open = true));
  await page.waitForTimeout(600);

  const anexos = await page.locator('#modal-overlay [data-action="del-art"]').count();
  if (anexos >= 2) ok('anexos aparecem no card', anexos + ' anexos'); else falha('anexos aparecem no card', anexos + ' (esperado 2)');

  // prova real: recarrega a pagina e reabre o card. Se o anexo sumir,
  // ele nunca foi gravado — que era exatamente o bug.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  await page.click('[data-page="tarefas"]').catch(() => {});
  await page.waitForTimeout(3500);
  await page.locator('[data-action="open-task-modal"]').filter({ hasText: 'ZZ TESTE' }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('#modal-overlay details').evaluateAll(ds => ds.forEach(d => d.open = true));
  await page.waitForTimeout(500);
  const persistiu = await page.locator('#modal-overlay [data-action="del-art"]').count();
  await page.screenshot({ path: path.join(SHOTS, 'b-anexos-apos-reload.png') });
  if (persistiu >= 2) ok('anexos PERSISTEM apos reload', persistiu + ' anexos'); else falha('anexos PERSISTEM apos reload', persistiu + ' (o anexo nao foi gravado)');

  // ── CHECKLIST ──
  await page.fill(`#new-check-${taskId}`, 'item de teste');
  await page.click(`[data-action="add-check-item"][data-id="${taskId}"]`);
  await page.waitForTimeout(2500);
  const itens = await page.locator('#modal-overlay .checklist-item').count();
  if (itens >= 1) ok('adicionar item de checklist', itens + ' item(ns)'); else falha('adicionar item de checklist');

  const chk = page.locator('#modal-overlay .checklist-item input[type=checkbox]').first();
  if (await chk.count()) { await chk.check(); await page.waitForTimeout(2000); ok('marcar item do checklist', (await chk.isChecked()) ? 'marcado' : 'nao marcou'); }

  // ── TAG ──
  await page.fill(`#new-tag-${taskId}`, 'tagteste');
  await page.press(`#new-tag-${taskId}`, 'Enter');
  await page.waitForTimeout(2500);
  const tags = await page.locator(`#task-tags-${taskId} .tag`).count();
  if (tags >= 1) ok('adicionar tag', tags + ' tag(s)'); else falha('adicionar tag');

  // ── EDITOR GRANDE DE BRIEFING (duplo clique) ──
  await page.dblclick(`#briefing-view-${taskId}`);
  await page.waitForTimeout(1500);
  const editorAberto = await page.locator('#briefing-editor-overlay').isVisible().catch(() => false);
  await page.screenshot({ path: path.join(SHOTS, 'b-editor-briefing.png') });
  if (editorAberto) {
    ok('duplo clique abre editor grande');
    const cardAtras = await page.locator('#modal-overlay').isVisible();
    if (cardAtras) ok('card continua aberto atras do editor'); else falha('card fechou ao abrir o editor');
    await page.fill('#be-text', 'Briefing reescrito pelo teste automatizado.');
    await page.click('#be-done');
    await page.waitForTimeout(3500);
    const txt = await page.locator(`#briefing-view-${taskId}`).innerText();
    if (/reescrito pelo teste/.test(txt)) ok('fechar editor salva o briefing'); else falha('fechar editor salva o briefing', txt.slice(0, 60));
  } else falha('duplo clique abre editor grande');

  // ── TROCAR DATA (campo novo) ──
  const inputData = page.locator('#modal-overlay input[type=date]').first();
  if (await inputData.count()) { await inputData.fill('2026-12-25'); await page.waitForTimeout(3000); ok('trocar data de postagem'); }
  else falha('trocar data de postagem', 'campo nao encontrado');

  await page.click('[data-action="close-modal"]'); await page.waitForTimeout(2500);

  // ── DRAG AND DROP (so entre etapas sem integracao) ──
  const nomesCol = await page.locator('.kanban-col').evaluateAll(els => els.map(e => e.getAttribute('data-col') || (e.querySelector('.kanban-col-title')?.innerText || '').trim()));
  const proibidas = /programad|enviado ao cliente|aprovad|publicad/i;
  const destino = nomesCol.find(c => c && !proibidas.test(c) && !/solicitad/i.test(c));
  if (destino) {
    const origem = page.locator(`[data-action="open-task-modal"]`).filter({ hasText: 'ZZ TESTE' }).first();
    const alvo = page.locator('.kanban-col').filter({ hasText: destino }).first();
    await origem.dragTo(alvo);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SHOTS, 'b-drag.png') });
    const moveu = await alvo.locator('text=ZZ TESTE').count();
    if (moveu) ok('arrastar card entre colunas', '-> ' + destino); else falha('arrastar card entre colunas', 'nao caiu em ' + destino);
  } else falha('arrastar card', 'nenhuma coluna segura encontrada em ' + JSON.stringify(nomesCol));

  // ── CALENDARIO: popup do dia ──
  await page.click('[data-page="calendario"]'); await page.waitForTimeout(3500);
  const dia = page.locator('[data-action="open-day-tasks"]').first();
  if (await dia.count()) {
    await dia.click(); await page.waitForTimeout(2000);
    const pop = await page.locator('#modal-overlay').isVisible().catch(() => false);
    await page.screenshot({ path: path.join(SHOTS, 'b-calendario-dia.png') });
    if (pop) { ok('popup do dia no calendario'); await page.click('[data-action="close-modal"]'); await page.waitForTimeout(1000); }
    else falha('popup do dia no calendario');
  } else falha('popup do dia', 'nenhum dia com card no mes atual');

  // ── LIMPEZA ──
  await page.click('[data-page="tarefas"]'); await page.waitForTimeout(3000);
  const paraApagar = page.locator(`[data-action="open-task-modal"]`).filter({ hasText: 'ZZ TESTE' }).first();
  if (await paraApagar.count()) {
    page.once('dialog', d => d.accept());
    await paraApagar.click(); await page.waitForTimeout(2500);
    await page.click('[data-action="delete-task"]');
    await page.waitForTimeout(4000);
    const sobrou = await page.locator(`[data-action="open-task-modal"]`).filter({ hasText: 'ZZ TESTE' }).count();
    if (!sobrou) ok('apagar card de teste'); else falha('apagar card de teste', 'ainda no board — APAGUE NA MAO');
  }

  console.log('\n' + JSON.stringify({ resumo: r.passos, errosJS: [...new Set(r.erros)] }, null, 2));
  await browser.close();
})().catch(e => { console.error('FALHA GERAL:', e.message); console.log(JSON.stringify(r, null, 2)); process.exit(1); });
