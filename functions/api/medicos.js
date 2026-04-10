import { requireAuth, json } from '../_lib/auth';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const rows = await env.DB.prepare(`
    SELECT id, nome, email, crm, especialidade, status
    FROM medicos
    WHERE status = 'ativo'
    ORDER BY nome
  `).all();

  return json({ ok: true, data: rows.results || [] });
}
