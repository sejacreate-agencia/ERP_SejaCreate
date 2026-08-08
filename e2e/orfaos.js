// Compara as pastas de tasks/ no bucket com as tarefas que ainda existem.
// LIMPA=1 apaga as pastas cujo card ja foi excluido.
const URL = 'https://owauukcjdasumguvzqch.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXV1a2NqZGFzdW1ndXZ6cWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzM3MjEsImV4cCI6MjA5MjIwOTcyMX0.015EF3h6El2eQKXxHlKkY9wkIr9c2a-e1BcKzx26Las';

if (!process.env.E2E_EMAIL || !process.env.E2E_PASS) {
  console.error('faltando E2E_EMAIL / E2E_PASS — veja o README');
  process.exit(1);
}

(async () => {
  const auth = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASS }),
  })).json();
  const H = { apikey: KEY, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' };

  const pastas = (await (await fetch(`${URL}/storage/v1/object/list/task-arts`, {
    method: 'POST', headers: H, body: JSON.stringify({ prefix: 'tasks', limit: 200 }),
  })).json()).map(o => o.name).filter(Boolean);

  const tarefas = await (await fetch(`${URL}/rest/v1/tasks?select=id`, { headers: H })).json();
  const vivas = new Set(tarefas.map(t => t.id));

  const orfas = pastas.filter(p => !vivas.has(p));
  console.log('pastas no bucket :', pastas.length);
  console.log('com tarefa viva  :', pastas.length - orfas.length);
  console.log('ORFAS            :', orfas.length);
  orfas.forEach(o => console.log('   ', o));

  // arquivos dentro das orfas
  let arquivos = [];
  for (const o of orfas) {
    const fs = await (await fetch(`${URL}/storage/v1/object/list/task-arts`, {
      method: 'POST', headers: H, body: JSON.stringify({ prefix: `tasks/${o}`, limit: 100 }),
    })).json();
    fs.forEach(f => arquivos.push(`tasks/${o}/${f.name}`));
  }
  console.log('arquivos nas orfas:', arquivos.length);

  if (process.env.LIMPA === '1' && arquivos.length) {
    const del = await fetch(`${URL}/storage/v1/object/task-arts`, {
      method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: arquivos }),
    });
    console.log('APAGADOS:', del.status, arquivos.length, 'arquivo(s)');
  }
})();
