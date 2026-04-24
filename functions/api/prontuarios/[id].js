// functions/api/prontuarios/[id].js
export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare(`
      SELECT p.*, 
             pac.nome as paciente_nome, pac.nascimento, pac.cpf, pac.convenio,
             m.nome as medico_nome, m.especialidade, m.cor as medico_cor
      FROM prontuarios p
      JOIN pacientes pac ON pac.id = p.paciente_id
      JOIN medicos m ON m.id = p.medico_id
      WHERE p.id = ?
    `).bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });
    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ env, params, request }) {
  try {
    const body = await request.json();
    const {
      paciente_id, medico_id, agendamento_id, data_consulta,
      queixa_principal, historia_doenca, antecedentes, medicamentos_uso, alergias,
      peso, altura, pressao_arterial, frequencia_cardiaca, temperatura, saturacao, exame_fisico,
      hipotese_diagnostica, cid, conduta, prescricao, retorno_dias, observacoes
    } = body;

    await env.DB.prepare(`
      UPDATE prontuarios SET
        paciente_id=?, medico_id=?, agendamento_id=?, data_consulta=?,
        queixa_principal=?, historia_doenca=?, antecedentes=?, medicamentos_uso=?, alergias=?,
        peso=?, altura=?, pressao_arterial=?, frequencia_cardiaca=?, temperatura=?, saturacao=?,
        exame_fisico=?, hipotese_diagnostica=?, cid=?, conduta=?, prescricao=?,
        retorno_dias=?, observacoes=?, atualizado_em=datetime('now')
      WHERE id=?
    `).bind(
      paciente_id, medico_id, agendamento_id || null, data_consulta,
      queixa_principal || '', historia_doenca || '', antecedentes || '',
      medicamentos_uso || '', alergias || '',
      peso || null, altura || null, pressao_arterial || '',
      frequencia_cardiaca || null, temperatura || null, saturacao || null,
      exame_fisico || '', hipotese_diagnostica || '', cid || '',
      conduta || '', prescricao || '', retorno_dias || null,
      observacoes || '', params.id
    ).run();

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM prontuarios WHERE id = ?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
