import { requireAuth, requireRole, json } from '../../_lib/auth';

export async function onRequestGet({ params, request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'medico', 'secretaria']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const pacienteId = Number(params.paciente_id || 0);

  if (!pacienteId) {
    return json({ ok: false, error: 'Paciente inválido' }, 400);
  }

  const paciente = await env.DB.prepare(`
    SELECT id, nome, telefone
    FROM pacientes
    WHERE id = ?
    LIMIT 1
  `).bind(pacienteId).first();

  if (!paciente) {
    return json({ ok: false, error: 'Paciente não encontrado' }, 404);
  }

  let prontuario = await env.DB.prepare(`
    SELECT *
    FROM prontuarios
    WHERE paciente_id = ?
    LIMIT 1
  `).bind(pacienteId).first();

  if (!prontuario) {
    const created = await env.DB.prepare(`
      INSERT INTO prontuarios (
        paciente_id, queixa_principal, hda, hmp, exame_fisico, exames, conduta, cid
      )
      VALUES (?, '', '', '', '', '', '', '')
    `).bind(pacienteId).run();

    prontuario = await env.DB.prepare(`
      SELECT *
      FROM prontuarios
      WHERE id = ?
      LIMIT 1
    `).bind(created.meta.last_row_id).first();
  }

  const evolucoes = await env.DB.prepare(`
    SELECT
      e.id,
      e.texto,
      e.criado_em,
      e.medico_id,
      m.nome AS medico_nome
    FROM evolucoes_prontuario e
    LEFT JOIN medicos m ON m.id = e.medico_id
    WHERE e.prontuario_id = ?
    ORDER BY e.id DESC
  `).bind(prontuario.id).all();

  return json({
    ok: true,
    data: {
      paciente,
      prontuario,
      evolucoes: evolucoes.results || []
    }
  });
}

export async function onRequestPut({ params, request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'medico']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const pacienteId = Number(params.paciente_id || 0);

  if (!pacienteId) {
    return json({ ok: false, error: 'Paciente inválido' }, 400);
  }

  const body = await request.json();

  let prontuario = await env.DB.prepare(`
    SELECT id
    FROM prontuarios
    WHERE paciente_id = ?
    LIMIT 1
  `).bind(pacienteId).first();

  if (!prontuario) {
    const created = await env.DB.prepare(`
      INSERT INTO prontuarios (
        paciente_id, queixa_principal, hda, hmp, exame_fisico, exames, conduta, cid
      )
      VALUES (?, '', '', '', '', '', '', '')
    `).bind(pacienteId).run();

    prontuario = { id: created.meta.last_row_id };
  }

  await env.DB.prepare(`
    UPDATE prontuarios
    SET
      queixa_principal = ?,
      hda = ?,
      hmp = ?,
      exame_fisico = ?,
      exames = ?,
      conduta = ?,
      cid = ?,
      atualizado_em = datetime('now')
    WHERE paciente_id = ?
  `).bind(
    String(body.queixa_principal || ''),
    String(body.hda || ''),
    String(body.hmp || ''),
    String(body.exame_fisico || ''),
    String(body.exames || ''),
    String(body.conduta || ''),
    String(body.cid || ''),
    pacienteId
  ).run();

  return json({ ok: true });
}
