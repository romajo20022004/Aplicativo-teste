function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';

  if (!auth.startsWith('Bearer ')) {
    return { ok: false, error: 'Não autenticado', status: 401 };
  }

  const token = auth.slice(7).trim();

  if (!token) {
    return { ok: false, error: 'Token ausente', status: 401 };
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
    return { ok: false, error: 'Sessão inválida', status: 401 };
  }

  if (row.status !== 'ativo') {
    return { ok: false, error: 'Usuário inativo', status: 403 };
  }

  if (new Date(row.expira_em).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`)
      .bind(token)
      .run();

    return { ok: false, error: 'Sessão expirada', status: 401 };
  }

  return {
    ok: true,
    user: {
      id: row.id,
      nome: row.nome,
      email: row.email,
      perfil: row.perfil
    }
  };
}

export function requireRole(auth, allowedRoles = []) {
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.user.perfil)) {
    return {
      ok: false,
      error: 'Acesso negado para este perfil',
      status: 403
    };
  }

  return { ok: true, user: auth.user };
}

export { json };
