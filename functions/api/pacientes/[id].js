export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare('SELECT * FROM pacientes WHERE id = ?')
      .bind(params.id).first();
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
      nome, nascimento, cpf, sexo, telefone, email,
      cep, logradouro, numero, complemento, bairro, cidade, estado,
      convenio, num_carteira, valor_consulta, status, observacoes
    } = body;
    if (!nome || !nascimento || !cpf || !sexo || !telefone) {
      return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });
    }
    await env.DB.prepare(`
      UPDATE pacientes SET
        nome=?, nascimento=?, cpf=?, sexo=?, telefone=?, email=?,
        cep=?, logradouro=?, numero=?, complemento=?, bairro=?, cidade=?, estado=?,
        convenio=?, num_carteira=?, valor_consulta=?, status=?, observacoes=?,
        atualizado_em=datetime('now')
      WHERE id=?
    `).bind(
      nome, nascimento, cpf, sexo, telefone, email || '',
      cep || '', logradouro || '', numero || '', complemento || '',
      bairro || '', cidade || '', estado || '',
      convenio || 'Particular', num_carteira || '',
      parseFloat(valor_consulta) || 0,
      status || 'ativo', observacoes || '',
      params.id
    ).run();
    return Response.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return Response.json({ ok: false, error: 'CPF já cadastrado' }, { status: 409 });
    }
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params, request }) {
  try {
    const url = new URL(request.url);
    const cascata = url.searchParams.get('cascata') === '1';
    const id = params.id;

    // Verificar vínculos
    const agendamentos = await env.DB.prepare('SELECT COUNT(*) as total FROM agendamentos WHERE paciente_id = ?').bind(id).first();
    const prontuarios  = await env.DB.prepare('SELECT COUNT(*) as total FROM prontuarios WHERE paciente_id = ?').bind(id).first();
    const lancamentos  = await env.DB.prepare('SELECT COUNT(*) as total FROM lancamentos WHERE agendamento_id IN (SELECT id FROM agendamentos WHERE paciente_id = ?)').bind(id).first();

    const totalAgendamentos = agendamentos?.total || 0;
    const totalProntuarios  = prontuarios?.total  || 0;
    const totalLancamentos  = lancamentos?.total  || 0;
    const temVinculos = totalAgendamentos > 0 || totalProntuarios > 0;

    // Se tem vínculos e não confirmou cascata, retornar aviso
    if (temVinculos && !cascata) {
      return Response.json({
        ok: false,
        temVinculos: true,
        agendamentos: totalAgendamentos,
        prontuarios:  totalProntuarios,
        lancamentos:  totalLancamentos,
        error: `Paciente possui ${totalAgendamentos} agendamento(s), ${totalProntuarios} prontuário(s) e ${totalLancamentos} lançamento(s) vinculados.`
      }, { status: 409 });
    }

    // Excluir em cascata
    if (temVinculos && cascata) {
      await env.DB.prepare('DELETE FROM lancamentos WHERE agendamento_id IN (SELECT id FROM agendamentos WHERE paciente_id = ?)').bind(id).run();
      await env.DB.prepare('DELETE FROM prontuarios WHERE paciente_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM agendamentos WHERE paciente_id = ?').bind(id).run();
    }

    await env.DB.prepare('DELETE FROM pacientes WHERE id = ?').bind(id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
