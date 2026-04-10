import { requireAuth } from '../../_lib/auth';

function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{ 'Content-Type':'application/json' }
  });
}

export async function onRequestDelete({ params, request, env }) {

  const auth = await requireAuth(request, env);
  if(!auth.ok) return json(auth, auth.status);

  const id = params.id;

  await env.DB.prepare(`
    DELETE FROM agendamentos
    WHERE id = ?
  `).bind(id).run();

  return json({ ok:true });
}
