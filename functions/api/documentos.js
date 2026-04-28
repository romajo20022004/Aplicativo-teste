// functions/api/documentos.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const paciente_id  = url.searchParams.get('paciente_id') || '';
    const prontuario_id = url.searchParams.get('prontuario_id') || '';
    const tipo         = url.searchParams.get('tipo') || '';

    let query = `
      SELECT d.*, p.nome as paciente_nome, m.nome as medico_nome, m.crm as medico_crm, m.especialidade
      FROM documentos d
      LEFT JOIN pacientes p ON p.id = d.paciente_id
      LEFT JOIN medicos m ON m.id = d.medico_id
      WHERE 1=1
    `;
    const params = [];

    if (paciente_id) { query += ' AND d.paciente_id = ?'; params.push(paciente_id); }
    if (prontuario_id) { query += ' AND d.prontuario_id = ?'; params.push(prontuario_id); }
    if (tipo) { query += ' AND d.tipo = ?'; params.push(tipo); }

    query += ' ORDER BY d.criado_em DESC';

    const result = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const { prontuario_id, paciente_id, medico_id, tipo, conteudo, data } = await request.json();

    if (!paciente_id || !medico_id || !tipo || !conteudo)
      return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });

    const result = await env.DB.prepare(`
      INSERT INTO documentos (prontuario_id, paciente_id, medico_id, tipo, conteudo, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      prontuario_id || null,
      paciente_id,
      medico_id,
      tipo,
      conteudo,
      data || new Date().toISOString().slice(0, 10)
    ).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
