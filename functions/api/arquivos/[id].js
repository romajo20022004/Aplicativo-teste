// functions/api/documentos/[id].js
export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare(`
      SELECT d.*, p.nome as paciente_nome, p.nascimento as paciente_nascimento,
             m.nome as medico_nome, m.crm as medico_crm, m.especialidade
      FROM documentos d
      LEFT JOIN pacientes p ON p.id = d.paciente_id
      LEFT JOIN medicos m ON m.id = d.medico_id
      WHERE d.id = ?
    `).bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });
    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ env, params, request }) {
  try {
    const { conteudo, data } = await request.json();
    await env.DB.prepare('UPDATE documentos SET conteudo=?, data=? WHERE id=?')
      .bind(conteudo, data, params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM documentos WHERE id=?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
