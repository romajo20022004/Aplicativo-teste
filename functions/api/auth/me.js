function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

export async function onRequestGet({ request, env }) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return json({ ok: false, error: 'Não autenticado' }, 401);
    }

    const row = await env.DB.prepare(`
      SELECT
        s.token,
        s.expira_em,
        u.id,
        u.nome,
        u.email,
        u.perfil,
        u.status
      FROM sessoes s
      INNER JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = ?
      LIMIT 1
    `).bind(token).first();

    if (!row) {
      return json({ ok: false, error: 'Sessão inválida' }, 401);
    }

    if (row.status !== 'ativo') {
      await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`).bind(token).run();
      return json({ ok: false, error: 'Usuário inativo' }, 401);
    }

    if (new Date(row.expira_em).getTime() < Date.now()) {
      await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`).bind(token).run();
      return json({ ok: false, error: 'Sessão expirada' }, 401);
    }

    return json({
      ok: true,
      user: {
        id: row.id,
        nome: row.nome,
        email: row.email,
        perfil: row.perfil
      }
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Erro interno ao validar sessão' }, 500);
  }
}
