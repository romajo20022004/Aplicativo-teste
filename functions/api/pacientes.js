import { requireAuth, requireRole, json } from '../_lib/auth';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const rows = await env.DB.prepare(`
    SELECT id, nome, telefone
    FROM pacientes
    ORDER BY id DESC
  `).all();

  return json({ ok: true, data: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'secretaria', 'medico']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const body = await request.json();

  const nome = String(body.nome || '').trim();
  const nascimento = String(body.nascimento || '').trim();
  const cpf = String(body.cpf || '').trim();
  const sexo = String(body.sexo || '').trim();
  const telefone = String(body.telefone || '').trim();

  if (!nome || !nascimento || !cpf || !sexo || !telefone) {
    return json({ ok: false, error: 'Campos obrigatórios ausentes' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO pacientes (nome, nascimento, cpf, sexo, telefone)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    nome,
    nascimento,
    cpf,
    sexo,
    telefone
  ).run();

  return json({ ok: true });
}
