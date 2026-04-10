export async function requireAuth(request, env) {

  const auth = request.headers.get('Authorization') || '';

  if (!auth.startsWith('Bearer ')) {
    return { ok:false, error:'Não autenticado', status:401 };
  }

  const token = auth.slice(7);

  const row = await env.DB.prepare(`
    SELECT u.id, u.nome, u.email, u.perfil
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ?
  `).bind(token).first();

  if (!row) {
    return { ok:false, error:'Sessão inválida', status:401 };
  }

  return { ok:true, user:row };
}
