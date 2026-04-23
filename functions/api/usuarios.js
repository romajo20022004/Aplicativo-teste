// functions/api/usuarios.js

async function hashSenha(senha) {
  const salt = 'clinicaapp_salt_2026';
  const data = new TextEncoder().encode(salt + senha);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verificarAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Token não fornecido' };
  const sessao = await env.DB.prepare(`
    SELECT s.*, u.id as uid, u.nome, u.email, u.perfil, u.medico_id, u.ativo
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_em > datetime('now') AND u.ativo = 1
  `).bind(token).first();
  if (!sessao) return { ok: false, status: 401, error: 'Sessão inválida ou expirada' };
  return { ok: true, usuario: { id: sessao.uid, nome: sessao.nome, email: sessao.email, perfil: sessao.perfil, medico_id: sessao.medico_id } };
}

export async function onRequestGet({ env, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.usuario.perfil !== 'admin') return Response.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    const result = await env.DB.prepare('SELECT id, nome, email, perfil, medico_id, ativo, criado_em FROM usuarios ORDER BY nome ASC').all();
    return Response.json({ ok: true, data: result.results });
  } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}

export async function onRequestPost({ env, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.usuario.perfil !== 'admin') return Response.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    const { nome, email, senha, perfil, medico_id } = await request.json();
    if (!nome || !email || !senha || !perfil) return Response.json({ ok: false, error: 'Campos obrigatórios faltando' }, { status: 400 });
    const senhaHash = await hashSenha(senha);
    const result = await env.DB.prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil, medico_id, ativo) VALUES (?,?,?,?,?,1)')
      .bind(nome, email.toLowerCase().trim(), senhaHash, perfil, medico_id || null).run();
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return Response.json({ ok: false, error: 'E-mail já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
