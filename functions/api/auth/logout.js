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

export async function onRequestPost({ request, env }) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return json({ ok: false, error: 'Token ausente' }, 401);
    }

    await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`)
      .bind(token)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Erro interno no logout' }, 500);
  }
}
