import { requireAuth, requireRole, json } from '../_lib/auth';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const url = new URL(request.url);
  const data = (url.searchParams.get('data') || '').trim();
  const medicoId = (url.searchParams.get('medico_id') || '').trim();

  let sql = `
    SELECT
      a.id,
      a.paciente_id,
      a.medico_id,
      a.data,
      a.hora,
      a.status,
      p.nome AS paciente_nome,
      p.telefone AS paciente_telefone,
      m.nome AS medico_nome
    FROM agendamentos a
    INNER JOIN pacientes p ON p.id = a.paciente_id
    LEFT JOIN medicos m ON m.id = a.medico_id
    WHERE 1=1
  `;

  const binds = [];

  if (data) {
    sql += ` AND a.data = ?`;
    binds.push(data);
  }

  if (medicoId) {
    sql += ` AND a.medico_id = ?`;
    binds.push(Number(medicoId));
  }

  sql += ` ORDER BY a.data ASC, a.hora ASC`;

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
    return json({ ok: false, error: 'Paciente, médico, data e hora são obrigatórios' }, 400);
  }

  const paciente = await env.DB.prepare(`
    SELECT id, nome
    FROM pacientes
    WHERE id = ?
    LIMIT 1
  `).bind(paciente_id).first();

  if (!paciente) {
    return json({ ok: false, error: 'Paciente não encontrado' }, 404);
  }

  const medico = await env.DB.prepare(`
    SELECT id, nome
    FROM medicos
    WHERE id = ? AND status = 'ativo'
    LIMIT 1
  `).bind(medico_id).first();

  if (!medico) {
    return json({ ok: false, error: 'Médico não encontrado' }, 404);
  }

  const conflito = await env.DB.prepare(`
    SELECT id
    FROM agendamentos
    WHERE medico_id = ?
      AND data = ?
      AND hora = ?
    LIMIT 1
  `).bind(medico_id, data, hora).first();

  if (conflito) {
    return json({ ok: false, error: 'Já existe agendamento para este médico nesse horário' }, 409);
  }

  const result = await env.DB.prepare(`
    INSERT INTO agendamentos (paciente_id, medico_id, data, hora, status)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    paciente_id,
    medico_id,
    data,
    hora,
    status
  ).run();

  return json({
    ok: true,
    id: result.meta?.last_row_id || null
  });
}
