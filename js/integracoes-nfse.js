// =============================================
// SEJA CREATE — INTEGRAÇÕES > NFS-e
// =============================================
// Configuração fiscal e diagnóstico. A EMISSÃO ainda não existe: depende do
// certificado e-CNPJ A1, que a empresa não tem. O que dá para adiantar — e é o
// trabalho mais demorado — é completar os dados fiscais dos clientes.
//
// Nada aqui chama serviço externo.

let _nfseCfg = null;
let _nfsePendencias = null;

function renderIntegracoesNfse() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">NFS-e</h1>
          <p class="page-subtitle">
            Configure a emissão de notas fiscais de serviço do seu negócio.
          </p>
        </div>
      </div>
    </div>
    <div id="nfse-corpo">
      <div class="loading-state" style="padding:40px;text-align:center;color:var(--text-muted)">
        <i class="fas fa-spinner fa-spin"></i> Carregando configuração fiscal...
      </div>
    </div>`;
  setTimeout(_nfseHidratar, 0);
}

const _NFSE_MOTIVOS = {
  certificado_ausente:      'Falta o certificado digital e-CNPJ A1.',
  municipio_nao_conveniado: 'O município ainda não aderiu ao Emissor Nacional.',
  dados_incompletos:        'Faltam dados fiscais do prestador.',
};

async function _nfseHidratar() {
  const alvo = document.getElementById('nfse-corpo');
  if (!alvo) return;

  const { data, error } = await DB.fiscalSettings.get();
  if (error && !data) {
    alvo.innerHTML = `
      <div class="card"><div class="empty-state" style="padding:30px">
        <i class="fas fa-database"></i>
        <p style="margin-top:8px;font-size:13px">
          ${isSupabaseReady()
            ? 'Rode a <code>supabase-migration-025.sql</code> para liberar a configuração fiscal.'
            : 'Disponível apenas na versão conectada ao Supabase.'}
        </p>
      </div></div>`;
    return;
  }
  _nfseCfg = data || {};
  _nfsePendencias = _nfseConferirClientes();

  alvo.innerHTML = _nfseStatusHtml() + _nfseEmpresaHtml() + _nfseClientesHtml();
}

// ─── Status ───────────────────────────────────
function _nfseStatusHtml() {
  const c = _nfseCfg;
  const habilitada = c.emissao_habilitada && c.municipio_conveniado;
  const estado = habilitada
    ? { cls: 'tag-green', dot: 'var(--success)',
        label: c.ambiente === 'producao' ? 'Produção' : 'Homologação' }
    : (c.cnpj
        ? { cls: 'tag-yellow', dot: 'var(--warning)', label: 'Configurado, emissão bloqueada' }
        : { cls: 'tag-gray', dot: 'var(--text-muted)', label: 'Não configurado' });

  const motivo = _NFSE_MOTIVOS[c.motivo_bloqueio] || c.motivo_bloqueio;

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-receipt"></i> Status</span>
        <span class="tag ${estado.cls}">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                       background:${estado.dot};margin-right:5px"></span>${estado.label}
        </span>
      </div>

      ${!habilitada ? `
        <div class="tag tag-yellow" style="display:block;padding:11px 13px;font-size:12px;line-height:1.6">
          <i class="fas fa-lock"></i> <strong>A emissão está desligada.</strong>
          ${motivo ? ` ${_nfseEsc(motivo)}` : ''}
          <br>Os dados abaixo podem ser preenchidos desde já — é o trabalho mais
          demorado, e não depende do certificado.
        </div>` : ''}

      <div style="margin-top:14px;font-size:12px;color:var(--text-secondary);line-height:1.7">
        A emissão será feita direto no <strong>Sefin Nacional</strong>, sem intermediário.
        Para isso são necessárias três coisas:
        <ol style="margin:8px 0 0 18px">
          <li>certificado digital <strong>e-CNPJ A1</strong> (arquivo .pfx);</li>
          <li>o município da empresa conveniado ao <strong>Emissor Nacional</strong>;</li>
          <li>os dados fiscais abaixo, seus e de cada cliente.</li>
        </ol>
      </div>
    </div>`;
}

// ─── Dados da empresa ─────────────────────────
function _nfseEmpresaHtml() {
  const c = _nfseCfg;
  const admin = SC.currentUser?.role === 'admin';
  const dis = admin ? '' : 'disabled';

  const txt = (id, campo, rotulo, dica) => `
    <div class="form-col">
      <label>${rotulo}</label>
      <input type="text" class="input-field" id="${id}" value="${_nfseEsc(c[campo] ?? '')}" ${dis}>
      ${dica ? `<span style="font-size:11px;color:var(--text-muted)">${dica}</span>` : ''}
    </div>`;

  const sel = (id, campo, rotulo, opcoes) => `
    <div class="form-col">
      <label>${rotulo}</label>
      <select class="select-field" id="${id}" ${dis}>
        ${opcoes.map(([v, l]) =>
          `<option value="${v}" ${String(c[campo]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>`;

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-building"></i> Dados da empresa</span>
        ${admin ? `
          <button class="btn btn-primary btn-sm" data-action="nfse-salvar-config">
            <i class="fas fa-check"></i> Salvar
          </button>` : '<span class="tag tag-gray">Somente leitura</span>'}
      </div>

      <div class="form-row">
        ${txt('fs-cnpj', 'cnpj', 'CNPJ')}
        ${txt('fs-im', 'inscricao_municipal', 'Inscrição Municipal')}
      </div>
      <div class="form-row">
        ${txt('fs-razao', 'razao_social', 'Razão Social')}
        ${txt('fs-fantasia', 'nome_fantasia', 'Nome Fantasia')}
      </div>
      <div class="form-row">
        ${txt('fs-cep', 'cep', 'CEP')}
        ${txt('fs-logradouro', 'logradouro', 'Logradouro')}
        ${txt('fs-numero', 'numero', 'Número')}
      </div>
      <div class="form-row">
        ${txt('fs-bairro', 'bairro', 'Bairro')}
        ${txt('fs-municipio', 'municipio', 'Município')}
        ${txt('fs-uf', 'uf', 'UF')}
        ${txt('fs-ibge', 'municipio_ibge', 'Código IBGE', '7 dígitos — é o cMun da nota')}
      </div>

      <div class="card-header" style="margin-top:20px">
        <span class="card-title" style="font-size:13px">Tributação</span>
      </div>
      <div class="form-row">
        ${txt('fs-regime', 'regime_tributario', 'Regime tributário')}
        ${sel('fs-simples', 'opcao_simples', 'Optante pelo Simples Nacional',
              [['true', 'Sim'], ['false', 'Não']])}
        ${txt('fs-especial', 'regime_especial', 'Regime especial', 'quando aplicável')}
      </div>

      <div class="card-header" style="margin-top:20px">
        <span class="card-title" style="font-size:13px">Serviço padrão</span>
      </div>
      <div class="form-row">
        ${txt('fs-codigo', 'codigo_servico', 'Código do serviço', 'tributação nacional / LC 116')}
        ${txt('fs-cnae', 'cnae', 'CNAE')}
        ${txt('fs-aliquota', 'aliquota_iss', 'Alíquota ISS', 'ex.: 0.0200 para 2%')}
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Descrição padrão do serviço</label>
          <input type="text" class="input-field" id="fs-desc"
                 value="${_nfseEsc(c.descricao_servico_padrao ?? '')}" ${dis}>
        </div>
      </div>

      <div class="card-header" style="margin-top:20px">
        <span class="card-title" style="font-size:13px">Emissão</span>
      </div>
      <div class="form-row">
        ${sel('fs-gatilho', 'gatilho_emissao', 'Quando emitir',
              [['manual', 'Manual'], ['pagamento', 'Ao confirmar pagamento'],
               ['competencia', 'Por competência']])}
        ${sel('fs-ambiente', 'ambiente', 'Ambiente',
              [['restrita', 'Produção restrita (testes)'], ['producao', 'Produção']])}
        ${txt('fs-serie', 'serie_dps', 'Série da DPS')}
      </div>
      <div class="form-row">
        <div class="form-col">
          <label style="display:flex;gap:9px;align-items:center;cursor:pointer">
            <input type="checkbox" id="fs-conveniado" ${c.municipio_conveniado ? 'checked' : ''} ${dis}>
            <span style="font-size:13px">Município conveniado ao Emissor Nacional</span>
          </label>
        </div>
        <div class="form-col">
          <label style="display:flex;gap:9px;align-items:center;cursor:pointer">
            <input type="checkbox" id="fs-habilitada" ${c.emissao_habilitada ? 'checked' : ''} ${dis}>
            <span style="font-size:13px">Emissão habilitada</span>
          </label>
        </div>
      </div>

      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.6">
        <strong>Quando emitir</strong> não é decisão técnica: para mensalidade, o fato
        gerador do ISS costuma ser a competência, não o recebimento. Confirme com o
        contador antes de mudar de "Manual".
      </p>
    </div>`;
}

// ─── Diagnóstico dos clientes ─────────────────
// Roda inteiro no navegador, sobre SC.clients. Nenhuma chamada externa: é só
// conferir quais campos exigidos pela NFS-e estão vazios.
const _NFSE_CAMPOS_TOMADOR = [
  ['documento',      'CPF/CNPJ'],
  ['razao_social',   'Razão social / nome'],
  ['cep',            'CEP'],
  ['logradouro',     'Logradouro'],
  ['numero',         'Número'],
  ['bairro',         'Bairro'],
  ['municipio',      'Município'],
  ['uf',             'UF'],
  ['municipio_ibge', 'Código IBGE'],
];

function _nfseConferirClientes() {
  const ativos = (SC.clients || []).filter(c => c.status !== 'inativo');
  return ativos.map(c => {
    const faltando = [];
    for (const [campo, rotulo] of _NFSE_CAMPOS_TOMADOR) {
      if (campo === 'documento') {
        if (!String(c.cnpj || c.cpf || '').replace(/\D/g, '')) faltando.push(rotulo);
      } else if (campo === 'razao_social') {
        if (!c.razao_social && !c.name) faltando.push(rotulo);
      } else if (!String(c[campo] || '').trim()) {
        faltando.push(rotulo);
      }
    }
    return { id: c.id, nome: c.name, faltando };
  }).sort((a, b) => b.faltando.length - a.faltando.length);
}

function _nfseClientesHtml() {
  const lista = _nfsePendencias || [];
  const prontos = lista.filter(c => !c.faltando.length).length;

  if (!lista.length) {
    return `<div class="card"><div class="empty-state" style="padding:24px">
      <i class="fas fa-users"></i><p style="margin-top:8px;font-size:13px">Nenhum cliente ativo.</p>
    </div></div>`;
  }

  const linhas = lista.map(c => `
    <tr>
      <td style="font-weight:600;font-size:13px">${_nfseEsc(c.nome)}</td>
      <td>
        ${c.faltando.length
          ? `<span class="tag tag-yellow">${c.faltando.length} pendência(s)</span>`
          : '<span class="tag tag-green">Completo</span>'}
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">
        ${c.faltando.length ? _nfseEsc(c.faltando.join(' · ')) : '—'}
      </td>
    </tr>`).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-user-check"></i> Dados fiscais dos clientes</span>
        <span style="font-size:12px;color:var(--text-muted)">
          ${prontos} de ${lista.length} prontos para emitir
        </span>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
        A NFS-e exige endereço completo e código IBGE do município do tomador.
        Complete em <strong>Cadastro → o cliente → Dados fiscais</strong>.
      </p>
      <div class="table-wrap">
        <table style="font-size:12px">
          <thead><tr><th>Cliente</th><th>Situação</th><th>O que falta</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </div>`;
}

function _nfseEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function nfseSalvarConfig() {
  const v = id => document.getElementById(id)?.value?.trim() ?? '';
  const nulo = s => s === '' ? null : s;

  const ibge = v('fs-ibge');
  if (ibge && !/^\d{7}$/.test(ibge)) {
    showToast('O código IBGE tem 7 dígitos.', 'error'); return;
  }
  const uf = v('fs-uf').toUpperCase();
  if (uf && uf.length !== 2) { showToast('A UF tem 2 letras.', 'error'); return; }

  const payload = {
    cnpj: nulo(v('fs-cnpj')), inscricao_municipal: nulo(v('fs-im')),
    razao_social: nulo(v('fs-razao')), nome_fantasia: nulo(v('fs-fantasia')),
    cep: nulo(v('fs-cep')), logradouro: nulo(v('fs-logradouro')),
    numero: nulo(v('fs-numero')), bairro: nulo(v('fs-bairro')),
    municipio: nulo(v('fs-municipio')), uf: nulo(uf), municipio_ibge: nulo(ibge),
    regime_tributario: nulo(v('fs-regime')),
    opcao_simples: v('fs-simples') === 'true',
    regime_especial: nulo(v('fs-especial')),
    codigo_servico: nulo(v('fs-codigo')), cnae: nulo(v('fs-cnae')),
    aliquota_iss: v('fs-aliquota') === '' ? null : Number(v('fs-aliquota')),
    descricao_servico_padrao: nulo(v('fs-desc')),
    gatilho_emissao: v('fs-gatilho'), ambiente: v('fs-ambiente'),
    serie_dps: v('fs-serie') || '00001',
    municipio_conveniado: !!document.getElementById('fs-conveniado')?.checked,
    emissao_habilitada: !!document.getElementById('fs-habilitada')?.checked,
  };

  // A trava tem que continuar significando alguma coisa: habilitar a emissão
  // sem município conveniado produziria só rejeição do Sefin.
  if (payload.emissao_habilitada && !payload.municipio_conveniado) {
    showToast('Marque o município como conveniado antes de habilitar a emissão.', 'error');
    return;
  }
  payload.motivo_bloqueio = payload.emissao_habilitada
    ? ''
    : (payload.municipio_conveniado ? 'certificado_ausente' : 'municipio_nao_conveniado');

  const { error } = await DB.fiscalSettings.salvar(_nfseCfg.org_id, payload);
  if (error) { showToast(`Não foi possível salvar: ${error.message}`, 'error'); return; }
  showToast('✅ Configuração fiscal salva.', 'success');
  _nfseHidratar();
}

Router.register('integracoes-nfse', renderIntegracoesNfse, 'Integrações · NFS-e');
