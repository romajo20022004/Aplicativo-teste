// functions/api/arquivos.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const paciente_id   = url.searchParams.get('paciente_id') || '';
    const prontuario_id = url.searchParams.get('prontuario_id') || '';

    let query = `SELECT * FROM arquivos WHERE 1=1`;
    const params = [];
    if (paciente_id)   { query += ' AND paciente_id = ?';   params.push(paciente_id); }
    if (prontuario_id) { query += ' AND prontuario_id = ?'; params.push(prontuario_id); }
    query += ' ORDER BY criado_em DESC';

    const result = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const formData = await request.formData();
    const file         = formData.get('file');
    const paciente_id  = formData.get('paciente_id');
    const prontuario_id = formData.get('prontuario_id') || null;
    const descricao    = formData.get('descricao') || '';

    if (!file || !paciente_id)
      return Response.json({ ok: false, error: 'Arquivo e paciente são obrigatórios' }, { status: 400 });

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024)
      return Response.json({ ok: false, error: 'Arquivo muito grande — máximo 2MB' }, { status: 400 });

    // Validar tipo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type))
      return Response.json({ ok: false, error: 'Tipo não permitido — use JPG, PNG ou PDF' }, { status: 400 });

    // Gerar nome único no storage
    const ext = file.name.split('.').pop();
    const nomeStorage = `paciente_${paciente_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload para R2
    const arrayBuffer = await file.arrayBuffer();
    await env.FILES_BUCKET.put(nomeStorage, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { paciente_id: String(paciente_id), nome_original: file.name }
    });

    // Salvar referência no D1
    const result = await env.DB.prepare(`
      INSERT INTO arquivos (paciente_id, prontuario_id, nome_original, nome_storage, tipo_mime, tamanho, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      paciente_id, prontuario_id, file.name, nomeStorage,
      file.type, file.size, descricao
    ).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
