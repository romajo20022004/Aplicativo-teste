// functions/api/prontuarios.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const paciente_id = url.searchParams.get('paciente_id') || '';
    const medico_id   = url.searchParams.get('medico_id') || '';

    let query = `
      SELECT p.*, 
             pac.nome as paciente_nome, pac.nascimento, pac.cpf,
             m.nome as medico_nome, m.especialidade, m.cor as medico_cor
      FROM prontuarios p
      JOIN pacientes pac ON pac.id = p.paciente_id
      JOIN medicos m ON m.id = p.medico_id
      WHERE 1=1
    `;
    const params = [];

    if (paciente_id) { query += ' AND p.paciente_id = ?'; params.push(paciente_id); }
    if (medico_id)   { query += ' AND p.medico_id = ?';   params.push(medico_id); }

    query += ' ORDER BY p.data_consulta DESC, p.criado_em DESC';

    const result = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const {
      paciente_id, medico_id, agendamento_id, data_consulta,
      queixa_principal, historia_doenca, antecedentes, medicamentos_uso, alergias,
      peso, altura, pressao_arterial, frequencia_cardiaca, temperatura, saturacao, exame_fisico,
      hipotese_diagnostica, cid, conduta, prescricao, retorno_dias, observacoes
    } = body;

    if (!paciente_id || !medico_id || !data_consulta)
      return Response.json({ ok: false, error: 'Paciente, médico e data são obrigatórios' }, { status: 400 });

    const result = await env.DB.prepare(`
      INSERT INTO prontuarios (
        paciente_id, medico_id, agendamento_id, data_consulta,
        queixa_principal, historia_doenca, antecedentes, medicamentos_uso, alergias,
        peso, altura, pressao_arterial, frequencia_cardiaca, temperatura, saturacao, exame_fisico,
        hipotese_diagnostica, cid, conduta, prescricao, retorno_dias, observacoes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      paciente_id, medico_id, agendamento_id || null, data_consulta,
      queixa_principal || '', historia_doenca || '', antecedentes || '',
      medicamentos_uso || '', alergias || '',
      peso || null, altura || null, pressao_arterial || '',
      frequencia_cardiaca || null, temperatura || null, saturacao || null,
      exame_fisico || '',
      hipotese_diagnostica || '', cid || '', conduta || '',
      prescricao || '', retorno_dias || null, observacoes || ''
    ).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
