// functions/api/agendamentos.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const data = url.searchParams.get('data') || new Date().toISOString().slice(0, 10);
    const medico_id = url.searchParams.get('medico_id') || '';

    let query = `
      SELECT a.*, p.nome as paciente_nome, p.telefone as paciente_tel, p.convenio as paciente_convenio,
             m.nome as medico_nome, m.especialidade, m.cor as medico_cor
      FROM agendamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      JOIN medicos m ON m.id = a.medico_id
      WHERE a.data = ?
    `;
    const params = [data];
    if (medico_id) { query += ' AND a.medico_id = ?'; params.push(medico_id); }
    query += ' ORDER BY a.hora ASC';
    const result = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const { paciente_id, medico_id, data, hora, duracao_min, tipo, valor, status_pgto, status_agenda, convenio, observacoes } = await request.json();
    if (!paciente_id || !medico_id || !data || !hora)
      return Response.json({ ok: false, error: 'Paciente, médico, data e hora são obrigatórios' }, { status: 400 });

    const conflito = await env.DB.prepare(
      `SELECT id FROM agendamentos WHERE medico_id=? AND data=? AND hora=? AND status_agenda NOT IN ('cancelado','faltou')`
    ).bind(medico_id, data, hora).first();
    if (conflito)
      return Response.json({ ok: false, error: 'Já existe agendamento neste horário para este médico' }, { status: 409 });

    const result = await env.DB.prepare(`
      INSERT INTO agendamentos (paciente_id, medico_id, data, hora, duracao_min, tipo, valor, status_pgto, status_agenda, convenio, observacoes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(paciente_id, medico_id, data, hora, duracao_min||30, tipo||'Consulta', parseFloat(valor)||0, status_pgto||'pendente', status_agenda||'agendado', convenio||'', observacoes||'').run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
