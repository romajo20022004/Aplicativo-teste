// functions/api/pacientes.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const search   = url.searchParams.get('q') || '';
    const status   = url.searchParams.get('status') || '';
    const medico_id= url.searchParams.get('medico_id') || '';

    let query = 'SELECT * FROM pacientes WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (nome LIKE ? OR cpf LIKE ? OR telefone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    // Filtrar pacientes que já tiveram consulta com este médico
    if (medico_id) {
      query += ` AND id IN (
        SELECT DISTINCT paciente_id FROM agendamentos WHERE medico_id = ?
        UNION
        SELECT DISTINCT paciente_id FROM prontuarios WHERE medico_id = ?
      )`;
      params.push(medico_id, medico_id);
    }

    query += ' ORDER BY nome ASC';
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
      nome, nascimento, cpf, sexo, telefone, email,
      cep, logradouro, numero, complemento, bairro, cidade, estado,
      convenio, num_carteira, valor_consulta, status, observacoes
    } = body;
    if (!nome || !nascimento || !cpf || !sexo || !telefone) {
      return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });
    }
    const result = await env.DB.prepare(`
      INSERT INTO pacientes
        (nome, nascimento, cpf, sexo, telefone, email,
         cep, logradouro, numero, complemento, bairro, cidade, estado,
         convenio, num_carteira, valor_consulta, status, observacoes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      nome, nascimento, cpf, sexo, telefone, email || '',
      cep || '', logradouro || '', numero || '', complemento || '',
      bairro || '', cidade || '', estado || '',
      convenio || 'Particular', num_carteira || '',
      parseFloat(valor_consulta) || 0,
      status || 'ativo', observacoes || ''
    ).run();
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return Response.json({ ok: false, error: 'CPF já cadastrado' }, { status: 409 });
    }
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
