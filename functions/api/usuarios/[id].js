// functions/api/usuarios/[id].js

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

export async function onRequestPut({ env, params, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.usuario.perfil !== 'admin') return Response.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    const { nome, email, senha, perfil, medico_id, ativo } = await request.json();
    if (senha) {
      const senhaHash = await hashSenha(senha);
      await env.DB.prepare('UPDATE usuarios SET nome=?, email=?, senha_hash=?, perfil=?, medico_id=?, ativo=? WHERE id=?')
        .bind(nome, email.toLowerCase().trim(), senhaHash, perfil, medico_id||null, ativo??1, params.id).run();
    } else {
      await env.DB.prepare('UPDATE usuarios SET nome=?, email=?, perfil=?, medico_id=?, ativo=? WHERE id=?')
        .bind(nome, email.toLowerCase().trim(), perfil, medico_id||null, ativo??1, params.id).run();
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return Response.json({ ok: false, error: 'E-mail já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.usuario.perfil !== 'admin') return Response.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    await env.DB.prepare('DELETE FROM usuarios WHERE id=?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
