// functions/api/agendamentos/[id].js
export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare(`
      SELECT a.*, p.nome as paciente_nome, m.nome as medico_nome, m.especialidade, m.cor as medico_cor
      FROM agendamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      JOIN medicos m ON m.id = a.medico_id
      WHERE a.id = ?
    `).bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });
    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ env, params, request }) {
  try {
    const { paciente_id, medico_id, data, hora, duracao_min, tipo, valor, status_pgto, status_agenda, convenio, observacoes } = await request.json();
    await env.DB.prepare(`
      UPDATE agendamentos SET
        paciente_id=?, medico_id=?, data=?, hora=?, duracao_min=?,
        tipo=?, valor=?, status_pgto=?, status_agenda=?, convenio=?, observacoes=?,
        atualizado_em=datetime('now')
      WHERE id=?
    `).bind(paciente_id, medico_id, data, hora, duracao_min||30, tipo||'Consulta', parseFloat(valor)||0, status_pgto||'pendente', status_agenda||'agendado', convenio||'', observacoes||'', params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM agendamentos WHERE id = ?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
