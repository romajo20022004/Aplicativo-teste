// functions/api/medicos/[id].js
export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare('SELECT * FROM medicos WHERE id = ?').bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });
    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ env, params, request }) {
  try {
    const { nome, crm, especialidade, telefone, email, cor, status, ver_todos_pacientes } = await request.json();
    if (!nome || !crm || !especialidade)
      return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });

    await env.DB.prepare(
      `UPDATE medicos SET nome=?, crm=?, especialidade=?, telefone=?, email=?, cor=?, status=?, ver_todos_pacientes=? WHERE id=?`
    ).bind(nome, crm, especialidade, telefone||'', email||'', cor||'#378ADD', status||'ativo', ver_todos_pacientes||0, params.id).run();

    return Response.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return Response.json({ ok: false, error: 'CRM já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM medicos WHERE id = ?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
