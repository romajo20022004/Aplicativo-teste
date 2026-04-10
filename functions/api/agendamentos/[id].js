import { requireAuth, requireRole, json } from '../../_lib/auth';

export async function onRequestDelete({ params, request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'secretaria']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const id = params.id;

  await env.DB.prepare(`
    DELETE FROM agendamentos
    WHERE id = ?
  `).bind(id).run();

  return json({ ok: true });
}
