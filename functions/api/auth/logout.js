// functions/api/auth/logout.js
export async function onRequestPost({ env, request }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '').trim();
    if (token) await env.DB.prepare('DELETE FROM sessoes WHERE token = ?').bind(token).run();
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
