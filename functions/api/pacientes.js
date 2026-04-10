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

  const rows = await env.DB.prepare(`
    SELECT id, nome, telefone
    FROM pacientes
    ORDER BY id DESC
  `).all();

  return json({ ok:true, data: rows.results });
}

export async function onRequestPost({ request, env }) {

  const auth = await requireAuth(request, env);
  if(!auth.ok) return json(auth, auth.status);

  const body = await request.json();

  await env.DB.prepare(`
    INSERT INTO pacientes (nome, nascimento, cpf, sexo, telefone)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    body.nome,
    body.nascimento,
    body.cpf,
    body.sexo,
    body.telefone
  ).run();

  return json({ ok:true });
}
