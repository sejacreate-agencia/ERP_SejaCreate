// Fase A — varredura somente leitura do ERP em producao.
// Navega por todas as telas, coleta erros de console/JS e tira screenshot.
// NAO cria, edita nem apaga nada.

const { chromium } = require('playwright');
const path = require('path');

const URL   = process.env.E2E_URL || 'http://app.sejacreate.com.br/';
const EMAIL = process.env.E2E_EMAIL;
const PASS  = process.env.E2E_PASS;
const SHOTS = path.join(__dirname, 'shots');

const PAGES = [
  'dashboard', 'tarefas', 'calendario', 'crm', 'cadastro',
  'planejamentos', 'onboarding', 'relatorios', 'relatorios-meta',
  'dashboard-marketing', 'avisos', 'configuracoes', 'cliente-area',
];

if (!process.env.E2E_EMAIL || !process.env.E2E_PASS) {
  console.error('faltando E2E_EMAIL / E2E_PASS — veja o README');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let tela = 'login';
  const erros = [];
  const push = (tipo, msg) => {
    const m = String(msg).slice(0, 300);
    // ruido conhecido de CDN/favicon nao interessa
    if (/favicon|net::ERR_|Failed to load resource/i.test(m)) return;
    erros.push({ tela, tipo, msg: m });
  };
  page.on('console', m => { if (m.type() === 'error') push('console', m.text()); });
  page.on('pageerror', e => push('js', e.message));

  const ir = async (p) => {
    tela = p;
    await page.click(`[data-page="${p}"]`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, `${p}.png`), fullPage: false });
  };

  // ── LOGIN ──
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-pass', PASS);
  await page.click('.btn-login');
  await page.waitForTimeout(6000);

  const logado = await page.locator('#app').isVisible().catch(() => false);
  await page.screenshot({ path: path.join(SHOTS, '00-pos-login.png') });
  if (!logado) {
    const aviso = await page.locator('.login-toast').textContent().catch(() => '(sem mensagem)');
    console.log(JSON.stringify({ ok: false, etapa: 'login', aviso, erros }, null, 2));
    await browser.close();
    process.exit(1);
  }

  // ── TELAS ──
  const vazias = [];
  for (const p of PAGES) {
    await ir(p);
    const txt = (await page.locator('#page-content').innerText().catch(() => '')).trim();
    if (txt.length < 40) vazias.push({ tela: p, chars: txt.length });
  }

  // ── ABRIR UM CARD (so leitura) ──
  tela = 'tarefas/card';
  await page.click('[data-page="tarefas"]');
  await page.waitForTimeout(3000);
  const card = page.locator('[data-action="open-task-modal"]').first();
  let cardAberto = false;
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(2500);
    cardAberto = await page.locator('#modal-overlay').isVisible().catch(() => false);
    await page.screenshot({ path: path.join(SHOTS, 'card-detalhe.png') });
    // as secoes que viraram <details> existem?
    const secoes = await page.locator('#modal-overlay details summary').allInnerTexts().catch(() => []);
    console.log(JSON.stringify({ secoesDoCard: secoes }, null, 2));
  }

  console.log(JSON.stringify({
    ok: true, logado, cardAberto,
    telasVazias: vazias,
    totalErros: erros.length,
    erros,
  }, null, 2));

  await browser.close();
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
