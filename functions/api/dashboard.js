// functions/api/dashboard.js
// ClinicaApp — Dashboard com dados reais do D1

export async function onRequestGet(context) {
  const { env, request } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // Verificar autenticação via cookie de sessão
    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/session=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return new Response(JSON.stringify({ erro: "Não autenticado" }), {
        status: 401,
        headers,
      });
    }

    // Validar sessão
    const sessao = await env.DB.prepare(
      `SELECT u.id, u.nome, u.perfil, u.medico_id
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_em > datetime('now') AND u.ativo = 1`
    )
      .bind(token)
      .first();

    if (!sessao) {
      return new Response(JSON.stringify({ erro: "Sessão inválida ou expirada" }), {
        status: 401,
        headers,
      });
    }

    const perfil = sessao.perfil;
    const medicoId = sessao.medico_id;

    // ── Totais base ──────────────────────────────────────────────
    const [totalPacientes, totalMedicos] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as total FROM pacientes").first(),
      env.DB.prepare("SELECT COUNT(*) as total FROM medicos").first(),
    ]);

    // ── Agendamentos hoje ────────────────────────────────────────
    let qAgendaHoje =
      perfil === "medico" && medicoId
        ? env.DB.prepare(
            `SELECT COUNT(*) as total FROM agendamentos
             WHERE date(data) = date('now','localtime') AND medico_id = ?`
          ).bind(medicoId)
        : env.DB.prepare(
            `SELECT COUNT(*) as total FROM agendamentos
             WHERE date(data) = date('now','localtime')`
          );

    // ── Agendamentos da semana ───────────────────────────────────
    let qAgendaSemana =
      perfil === "medico" && medicoId
        ? env.DB.prepare(
            `SELECT COUNT(*) as total FROM agendamentos
             WHERE date(data) >= date('now','localtime','-6 days')
               AND date(data) <= date('now','localtime') AND medico_id = ?`
          ).bind(medicoId)
        : env.DB.prepare(
            `SELECT COUNT(*) as total FROM agendamentos
             WHERE date(data) >= date('now','localtime','-6 days')
               AND date(data) <= date('now','localtime')`
          );

    const [agendaHoje, agendaSemana] = await Promise.all([
      qAgendaHoje.first(),
      qAgendaSemana.first(),
    ]);

    // ── Financeiro do mês ────────────────────────────────────────
    let qFinMes =
      perfil === "medico" && medicoId
        ? env.DB.prepare(
            `SELECT
               COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),0) as receitas,
               COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),0) as despesas
             FROM lancamentos
             WHERE strftime('%Y-%m', data) = strftime('%Y-%m','now','localtime')
               AND medico_id = ?`
          ).bind(medicoId)
        : env.DB.prepare(
            `SELECT
               COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),0) as receitas,
               COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),0) as despesas
             FROM lancamentos
             WHERE strftime('%Y-%m', data) = strftime('%Y-%m','now','localtime')`
          );

    const finMes = await qFinMes.first();

    // ── Próximos agendamentos (lista) ────────────────────────────
    let qProximos =
      perfil === "medico" && medicoId
        ? env.DB.prepare(
            `SELECT a.id, a.data, a.hora, a.status,
                    p.nome as paciente_nome,
                    m.nome as medico_nome
             FROM agendamentos a
             JOIN pacientes p ON p.id = a.paciente_id
             JOIN medicos m   ON m.id = a.medico_id
             WHERE date(a.data) >= date('now','localtime')
               AND a.medico_id = ?
             ORDER BY a.data ASC, a.hora ASC
             LIMIT 8`
          ).bind(medicoId)
        : env.DB.prepare(
            `SELECT a.id, a.data, a.hora, a.status,
                    p.nome as paciente_nome,
                    m.nome as medico_nome
             FROM agendamentos a
             JOIN pacientes p ON p.id = a.paciente_id
             JOIN medicos m   ON m.id = a.medico_id
             WHERE date(a.data) >= date('now','localtime')
             ORDER BY a.data ASC, a.hora ASC
             LIMIT 8`
          );

    const proximos = await qProximos.all();

    // ── Últimos pacientes cadastrados ────────────────────────────
    const ultimosPacientes = await env.DB.prepare(
      `SELECT id, nome, telefone, created_at
       FROM pacientes
       ORDER BY rowid DESC
       LIMIT 5`
    ).all();

    // ── Receita dos últimos 6 meses (gráfico) ───────────────────
    const receitaMeses = await env.DB.prepare(
      `SELECT strftime('%Y-%m', data) as mes,
              COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),0) as receitas,
              COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),0) as despesas
       FROM lancamentos
       WHERE date(data) >= date('now','localtime','-5 months','start of month')
       GROUP BY mes
       ORDER BY mes ASC`
    ).all();

    // ── Agendamentos por status hoje ─────────────────────────────
    const statusHoje = await env.DB.prepare(
      `SELECT status, COUNT(*) as total
       FROM agendamentos
       WHERE date(data) = date('now','localtime')
       GROUP BY status`
    ).all();

    // ── Montar resposta ──────────────────────────────────────────
    const saldo = (finMes?.receitas || 0) - (finMes?.despesas || 0);

    return new Response(
      JSON.stringify({
        ok: true,
        usuario: {
          nome: sessao.nome,
          perfil: sessao.perfil,
        },
        cards: {
          totalPacientes: totalPacientes?.total || 0,
          totalMedicos: totalMedicos?.total || 0,
          agendamentosHoje: agendaHoje?.total || 0,
          agendamentosSemana: agendaSemana?.total || 0,
          receitaMes: finMes?.receitas || 0,
          despesaMes: finMes?.despesas || 0,
          saldoMes: saldo,
        },
        proximosAgendamentos: proximos?.results || [],
        ultimosPacientes: ultimosPacientes?.results || [],
        graficoMeses: receitaMeses?.results || [],
        statusHoje: statusHoje?.results || [],
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Erro no dashboard:", err);
    return new Response(
      JSON.stringify({
        erro: "Erro interno no dashboard",
        detalhe: err.message,
      }),
      { status: 500, headers }
    );
  }
}

// Suporte a CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
