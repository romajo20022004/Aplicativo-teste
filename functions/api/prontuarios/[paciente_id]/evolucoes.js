import { requireAuth, requireRole, json } from '../../../_lib/auth';

export async function onRequestPost({ params, request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json(auth, auth.status);

  const roleCheck = requireRole(auth, ['admin', 'medico']);
  if (!roleCheck.ok) return json(roleCheck, roleCheck.status);

  const pacienteId = Number(params.paciente_id || 0);

  if (!pacienteId) {
    return json({ ok: false, error: 'Paciente inválido' }, 400);
  }

  const body = await request.json();
  const texto = String(body.texto || '').trim();

  if (!texto) {
    return json({ ok: false, error: 'Texto da evolução é obrigatório' }, 400);
  }

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

  let medicoId = null;

  if (auth.user.perfil === 'medico') {
    const med = await env.DB.prepare(`
      SELECT id
      FROM medicos
      WHERE lower(email) = lower(?)
      LIMIT 1
    `).bind(auth.user.email).first();

    if (med) medicoId = med.id;
  }

  await env.DB.prepare(`
    INSERT INTO evolucoes_prontuario (prontuario_id, medico_id, texto)
    VALUES (?, ?, ?)
  `).bind(
    prontuario.id,
    medicoId,
    texto
  ).run();

  return json({ ok: true });
}
