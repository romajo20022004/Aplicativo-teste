// functions/api/auth/login.js
async function hashSenha(senha) {
  const salt = 'clinicaapp_salt_2026';
  const data = new TextEncoder().encode(salt + senha);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function gerarToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ env, request }) {
  try {
    const { email, senha } = await request.json();
    if (!email || !senha)
      return Response.json({ ok: false, error: 'E-mail e senha são obrigatórios' }, { status: 400 });

    const senhaHash = await hashSenha(senha);
    const usuario = await env.DB.prepare(
      'SELECT * FROM usuarios WHERE email = ? AND senha_hash = ? AND ativo = 1'
    ).bind(email.toLowerCase().trim(), senhaHash).first();

    if (!usuario)
      return Response.json({ ok: false, error: 'E-mail ou senha incorretos' }, { status: 401 });

    // Remover sessões expiradas
    await env.DB.prepare(
      "DELETE FROM sessoes WHERE usuario_id = ? AND expira_em < datetime('now')"
    ).bind(usuario.id).run();

    // Verificar sessões ativas — limite de 2 (usando rowid)
    const sessoes = await env.DB.prepare(
      "SELECT rowid FROM sessoes WHERE usuario_id = ? ORDER BY rowid ASC"
    ).bind(usuario.id).all();

    if (sessoes.results.length >= 2) {
      // Remover a sessão mais antiga
      const maisAntiga = sessoes.results[0];
      await env.DB.prepare('DELETE FROM sessoes WHERE rowid = ?').bind(maisAntiga.rowid).run();
    }

    // Criar nova sessão
    const token  = gerarToken();
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19);

    await env.DB.prepare(
      'INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?,?,?)'
    ).bind(usuario.id, token, expira).run();

    return Response.json({
      ok: true,
      token,
      usuario: {
        id:        usuario.id,
        nome:      usuario.nome,
        email:     usuario.email,
        perfil:    usuario.perfil,
        medico_id: usuario.medico_id
      }
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
