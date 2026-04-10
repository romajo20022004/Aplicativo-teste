import { requireAuth } from '../_lib/auth';

function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{ 'Content-Type':'application/json' }
  });
}

export async function onRequestGet({ request, env }) {

  const auth = await requireAuth(request, env);
  if(!auth.ok) return json(auth, auth.status);

  const url = new URL(request.url);
  const data = url.searchParams.get('data');

  const rows = await env.DB.prepare(`
    SELECT a.*, p.nome as paciente_nome
    FROM agendamentos a
    JOIN pacientes p ON p.id = a.paciente_id
    WHERE a.data = ?
    ORDER BY a.hora
  `).bind(data).all();

  return json({ ok:true, data: rows.results });
}

export async function onRequestPost({ request, env }) {

  const auth = await requireAuth(request, env);
  if(!auth.ok) return json(auth, auth.status);

  const body = await request.json();

  await env.DB.prepare(`
    INSERT INTO agendamentos (paciente_id, data, hora, status)
    VALUES (?, ?, ?, ?)
  `).bind(
    body.paciente_id,
    body.data,
    body.hora,
    body.status
  ).run();

  return json({ ok:true });
}
