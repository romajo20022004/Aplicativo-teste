import { requireAuth, requireRole, json } from '../_lib/auth';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const url = new URL(request.url);
  const data = url.searchParams.get('data');
  const medicoId = url.searchParams.get('medico_id');

  if (!data) {
    return json({ ok: true, data: [] });
  }

  let sql = `
    SELECT
      a.id,
      a.paciente_id,
      a.medico_id,
      a.data,
      a.hora,
      a.status,
      p.nome AS paciente_nome,
      m.nome AS medico_nome
    FROM agendamentos a
    JOIN pacientes p ON p.id = a.paciente_id
    LEFT JOIN medicos m ON m.id = a.medico_id
    WHERE a.data = ?
  `;

  const binds = [data];

  if (medicoId) {
    sql += ` AND a.medico_id = ?`;
    binds.push(Number(medicoId));
  }

  sql += ` ORDER BY a.hora`;

  const rows = await env.DB.prepare(sql).bind(...binds).all();

  return json({ ok: true, data: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'secretaria', 'medico']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const body = await request.json();

  const paciente_id = Number(body.paciente_id || 0);
  const medico_id = Number(body.medico_id || 0);
  const data = String(body.data || '').trim();
  const hora = String(body.hora || '').trim();
  const status = String(body.status || 'agendado').trim();

  if (!paciente_id || !medico_id || !data || !hora) {
    return json({ ok: false, error: 'Campos obrigatórios ausentes' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO agendamentos (paciente_id, medico_id, data, hora, status)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    paciente_id,
    medico_id,
    data,
    hora,
    status
  ).run();

  return json({ ok: true });
}
