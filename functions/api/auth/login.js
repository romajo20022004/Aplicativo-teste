async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const senha = String(body.senha || '');

    if (!email || !senha) {
      return json({ ok: false, error: 'E-mail e senha são obrigatórios' }, 400);
    }

    const user = await env.DB.prepare(`
      SELECT id, nome, email, senha_hash, perfil, status
      FROM usuarios
      WHERE lower(email) = ?
      LIMIT 1
    `).bind(email).first();

    if (!user || user.status !== 'ativo') {
      return json({ ok: false, error: 'Credenciais inválidas' }, 401);
    }

    const senhaHash = await sha256(senha);

    if (senhaHash !== user.senha_hash) {
      return json({ ok: false, error: 'Credenciais inválidas' }, 401);
    }

    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO sessoes (token, usuario_id, expira_em)
      VALUES (?, ?, ?)
    `).bind(token, user.id, expiraEm).run();

    return json({
      ok: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      }
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Erro interno no login' }, 500);
  }
}
