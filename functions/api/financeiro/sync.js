// functions/api/financeiro/sync.js
// POST /api/financeiro/sync — importa agendamentos realizados como lançamentos
export async function onRequestPost({ env, request }) {
  try {
    const { data_ini, data_fim } = await request.json();

    // Buscar agendamentos realizados que ainda não têm lançamento
    const agendamentos = await env.DB.prepare(`
      SELECT a.*, p.nome as paciente_nome, p.convenio, m.nome as medico_nome
      FROM agendamentos a
      JOIN pacientes p ON p.id = a.paciente_id
      JOIN medicos m ON m.id = a.medico_id
      WHERE a.status_agenda = 'realizado'
        AND date(a.data) BETWEEN ? AND ?
        AND a.id NOT IN (SELECT agendamento_id FROM lancamentos WHERE agendamento_id IS NOT NULL)
    `).bind(data_ini, data_fim).all();

    let importados = 0;
    for (const ag of agendamentos.results) {
      await env.DB.prepare(`
        INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, medico_id, agendamento_id, status, forma_pgto)
        VALUES ('receita', ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        ag.convenio || 'Particular',
        `Consulta — ${ag.paciente_nome}`,
        ag.valor || 0,
        ag.data,
        ag.medico_id,
        ag.id,
        ag.status_pgto === 'pago' ? 'confirmado' : 'pendente',
        ag.status_pgto === 'pago' ? 'dinheiro' : 'pendente'
      ).run();
      importados++;
    }

    return Response.json({ ok: true, importados });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
