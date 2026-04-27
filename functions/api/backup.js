// functions/api/backup.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const formato = url.searchParams.get('formato') || 'sql';

    const [pacientes, medicos, agendamentos, lancamentos, prontuarios] = await Promise.all([
      env.DB.prepare('SELECT * FROM pacientes ORDER BY nome').all(),
      env.DB.prepare('SELECT id,nome,crm,especialidade,telefone,email,cor,status,ver_todos_pacientes FROM medicos ORDER BY nome').all(),
      env.DB.prepare('SELECT * FROM agendamentos ORDER BY data,hora').all(),
      env.DB.prepare('SELECT * FROM lancamentos ORDER BY data').all(),
      env.DB.prepare('SELECT * FROM prontuarios ORDER BY data_consulta').all(),
    ]);

    const dados = {
      gerado_em: new Date().toISOString(),
      pacientes: pacientes.results,
      medicos: medicos.results,
      agendamentos: agendamentos.results,
      lancamentos: lancamentos.results,
      prontuarios: prontuarios.results,
    };

    const hoje = new Date().toISOString().slice(0,10);

    // Registrar backup feito hoje
    await env.DB.prepare(`
      INSERT OR REPLACE INTO config (chave, valor) VALUES ('ultimo_backup', ?)
    `).bind(hoje).run();

    if (formato === 'csv') {
      const csv = gerarCSV(dados);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="clinicaapp_backup_${hoje}.csv"`
        }
      });
    }

    // SQL
    const sql = gerarSQL(dados);
    return new Response(sql, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="clinicaapp_backup_${hoje}.sql"`
      }
    });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env }) {
  // Verificar status do backup de hoje
  try {
    const hoje = new Date().toISOString().slice(0,10);
    const row = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'ultimo_backup'").first();
    const ultimoBackup = row?.valor || null;
    return Response.json({ ok: true, ultimo_backup: ultimoBackup, backup_hoje: ultimoBackup === hoje });
  } catch(e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function gerarSQL(dados) {
  let sql = `-- ClinicaApp Backup\n-- Gerado em: ${dados.gerado_em}\n-- Para restaurar: execute no console D1 do Cloudflare\n\n`;

  const tabelas = ['pacientes', 'medicos', 'agendamentos', 'lancamentos', 'prontuarios'];

  tabelas.forEach(tabela => {
    const rows = dados[tabela];
    if (!rows || !rows.length) return;
    sql += `-- ${tabela.toUpperCase()}\n`;
    rows.forEach(row => {
      const cols = Object.keys(row).join(', ');
      const vals = Object.values(row).map(v =>
        v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`
      ).join(', ');
      sql += `INSERT OR REPLACE INTO ${tabela} (${cols}) VALUES (${vals});\n`;
    });
    sql += '\n';
  });

  return sql;
}

function gerarCSV(dados) {
  let csv = '';

  const tabelas = {
    'PACIENTES': dados.pacientes,
    'MEDICOS': dados.medicos,
    'AGENDAMENTOS': dados.agendamentos,
    'LANCAMENTOS': dados.lancamentos,
    'PRONTUARIOS': dados.prontuarios,
  };

  Object.entries(tabelas).forEach(([nome, rows]) => {
    if (!rows || !rows.length) return;
    csv += `\n=== ${nome} ===\n`;
    csv += Object.keys(rows[0]).join(';') + '\n';
    rows.forEach(row => {
      csv += Object.values(row).map(v =>
        v === null ? '' : `"${String(v).replace(/"/g, '""')}"`
      ).join(';') + '\n';
    });
  });

  return csv;
}
