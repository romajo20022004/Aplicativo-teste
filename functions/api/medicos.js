// functions/api/medicos.js
export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM medicos ORDER BY nome ASC'
    ).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const { nome, crm, especialidade, telefone, email, cor, status, ver_todos_pacientes } = await request.json();
    if (!nome || !crm || !especialidade)
      return Response.json({ ok: false, error: 'Nome, CRM e especialidade são obrigatórios' }, { status: 400 });

    const result = await env.DB.prepare(
      `INSERT INTO medicos (nome, crm, especialidade, telefone, email, cor, status, ver_todos_pacientes)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(nome, crm, especialidade, telefone||'', email||'', cor||'#378ADD', status||'ativo', ver_todos_pacientes||0).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return Response.json({ ok: false, error: 'CRM já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
