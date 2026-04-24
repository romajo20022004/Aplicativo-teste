// functions/api/usuarios.js
// Sem autenticação por enquanto - protegido pelo frontend

async function hashSenha(senha) {
  const salt = 'clinicaapp_salt_2026';
  const data = new TextEncoder().encode(salt + senha);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT id, nome, email, perfil, medico_id, ativo, criado_em FROM usuarios ORDER BY nome ASC'
    ).all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const { nome, email, senha, perfil, medico_id } = await request.json();
    if (!nome || !email || !senha || !perfil)
      return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });
    const senhaHash = await hashSenha(senha);
    const result = await env.DB.prepare(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil, medico_id, ativo) VALUES (?,?,?,?,?,1)'
    ).bind(nome, email.toLowerCase().trim(), senhaHash, perfil, medico_id || null).run();
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return Response.json({ ok: false, error: 'E-mail já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
