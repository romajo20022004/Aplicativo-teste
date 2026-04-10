// functions/api/pacientes/[id].js
// GET    /api/pacientes/:id  → busca um
// PUT    /api/pacientes/:id  → atualiza
// DELETE /api/pacientes/:id  → remove

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

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM pacientes WHERE id = ?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
