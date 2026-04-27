// functions/api/dashboard.js
// ClinicaApp — Dashboard com dados reais do D1

export async function onRequestGet(context) {
  const { env, request } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // Verificar autenticação via Bearer token (igual às outras APIs)
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

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

    // ── Agendamentos hoje (contagem) ─────────────────────────────
    const qAgendaHoje = (perfil === "medico" && medicoId)
      ? env.DB.prepare(`SELECT COUNT(*) as total FROM agendamentos WHERE date(data) = date('now','localtime') AND medico_id = ?`).bind(medicoId)
      : env.DB.prepare(`SELECT COUNT(*) as total FROM agendamentos WHERE date(data) = date('now','localtime')`);

    // ── Agendamentos da semana ───────────────────────────────────
    const qAgendaSemana = (perfil === "medico" && medicoId)
      ? env.DB.prepare(`SELECT COUNT(*) as total FROM agendamentos WHERE date(data) >= date('now','localtime','-6 days') AND date(data) <= date('now','localtime') AND medico_id = ?`).bind(medicoId)
      : env.DB.prepare(`SELECT COUNT(*) as total FROM agendamentos WHERE date(data) >= date('now','localtime','-6 days') AND date(data) <= date('now','localtime')`);

    const [agendaHoje, agendaSemana] = await Promise.all([
      qAgendaHoje.first(),
      qAgendaSemana.first(),
    ]);

    // ── Financeiro do mês ────────────────────────────────────────
    const qFinMes = (perfil === "medico" && medicoId)
      ? env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),0) as receitas, COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),0) as despesas FROM lancamentos WHERE strftime('%Y-%m', data) = strftime('%Y-%m','now','localtime') AND medico_id = ?`).bind(medicoId)
      : env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),0) as receitas, COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),0) as despesas FROM lancamentos WHERE strftime('%Y-%m', data) = strftime('%Y-%m','now','localtime')`);

    const finMes = await qFinMes.first();

    // ── Agenda de hoje detalhada (tabela no dashboard) ───────────
    const qAgendaDetalhe = (perfil === "medico" && medicoId)
      ? env.DB.prepare(`SELECT a.id, a.hora, a.tipo, a.status_agenda, a.status_pgto, a.valor, p.nome as paciente_nome, m.nome as medico_nome, m.cor as medico_cor, m.especialidade FROM agendamentos a JOIN pacientes p ON p.id = a.paciente_id JOIN medicos m ON m.id = a.medico_id WHERE date(a.data) = date('now','localtime') AND a.medico_id = ? ORDER BY a.hora ASC`).bind(medicoId)
      : env.DB.prepare(`SELECT a.id, a.hora, a.tipo, a.status_agenda, a.status_pgto, a.valor, p.nome as paciente_nome, m.nome as medico_nome, m.cor as medico_cor, m.especialidade FROM agendamentos a JOIN pacientes p ON p.id = a.paciente_id JOIN medicos m ON m.id = a.medico_id WHERE date(a.data) = date('now','localtime') ORDER BY a.hora ASC`);

    const agendaDetalhe = await qAgendaDetalhe.all();

    // ── Aniversariantes do mês ───────────────────────────────────
    const aniversariantes = await env.DB.prepare(
      `SELECT id, nome, nascimento, telefone FROM pacientes WHERE strftime('%m', nascimento) = strftime('%m','now','localtime') AND status = 'ativo' ORDER BY strftime('%d', nascimento) ASC LIMIT 10`
    ).all();

    // ── Últimos pacientes cadastrados ────────────────────────────
    const ultimosPacientes = await env.DB.prepare(
      `SELECT id, nome, telefone, convenio FROM pacientes ORDER BY rowid DESC LIMIT 5`
    ).all();

    // ── Pendências (lançamentos pendentes) ───────────────────────
    const qPendencias = (perfil === "medico" && medicoId)
      ? env.DB.prepare(`SELECT COUNT(*) as total FROM lancamentos WHERE status = 'pendente' AND medico_id = ?`).bind(medicoId)
      : env.DB.prepare(`SELECT COUNT(*) as total FROM lancamentos WHERE status = 'pendente'`);

    const pendencias = await qPendencias.first();

    // ── Resposta final ───────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok: true,
        usuario: { nome: sessao.nome, perfil: sessao.perfil },
        // Nomes exatos que o loadDashboard() do app.js usa:
        totalPacientes: totalPacientes?.total || 0,
        consultasHoje:  agendaHoje?.total || 0,
        receitaMes:     finMes?.receitas || 0,
        despesaMes:     finMes?.despesas || 0,
        saldoMes:       (finMes?.receitas || 0) - (finMes?.despesas || 0),
        agendamentosSemana: agendaSemana?.total || 0,
        totalMedicos:   totalMedicos?.total || 0,
        pendencias:     pendencias?.total || 0,
        agendaHoje:     agendaDetalhe?.results || [],
        aniversariantes: aniversariantes?.results || [],
        ultimosPacientes: ultimosPacientes?.results || [],
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Erro no dashboard:", err);
    return new Response(
      JSON.stringify({ erro: "Erro interno no dashboard", detalhe: err.message }),
      { status: 500, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
