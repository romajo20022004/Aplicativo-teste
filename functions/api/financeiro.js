// functions/api/financeiro.js
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const modo     = url.searchParams.get('modo') || 'mes';     // mes | dia | periodo
    const data_ini = url.searchParams.get('data_ini') || new Date().toISOString().slice(0,7) + '-01';
    const data_fim = url.searchParams.get('data_fim') || new Date().toISOString().slice(0,10);
    const medico_id= url.searchParams.get('medico_id') || '';

    // Montar filtro de data
    let whereData = 'date(l.data) BETWEEN ? AND ?';
    const dateParams = [data_ini, data_fim];

    let whereExtra = '';
    const extraParams = [];
    if (medico_id) {
      whereExtra = ' AND l.medico_id = ?';
      extraParams.push(medico_id);
    }

    const allParams = [...dateParams, ...extraParams];

    // ── Resumo geral ──
    const resumo = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='receita' AND status!='cancelado' THEN valor ELSE 0 END),0) as total_receita,
        COALESCE(SUM(CASE WHEN tipo='despesa' AND status!='cancelado' THEN valor ELSE 0 END),0) as total_despesa,
        COALESCE(SUM(CASE WHEN tipo='receita' AND status='pendente'   THEN valor ELSE 0 END),0) as receita_pendente,
        COUNT(CASE WHEN tipo='receita' AND status!='cancelado' THEN 1 END) as qtd_receitas,
        COUNT(CASE WHEN tipo='despesa' AND status!='cancelado' THEN 1 END) as qtd_despesas
      FROM lancamentos l
      WHERE ${whereData}${whereExtra}
    `).bind(...allParams).first();

    // ── Receita por médico ──
    const porMedico = await env.DB.prepare(`
      SELECT m.nome, m.especialidade, m.cor,
        COALESCE(SUM(CASE WHEN l.tipo='receita' AND l.status!='cancelado' THEN l.valor ELSE 0 END),0) as total,
        COUNT(CASE WHEN l.tipo='receita' AND l.status!='cancelado' THEN 1 END) as qtd
      FROM medicos m
      LEFT JOIN lancamentos l ON l.medico_id = m.id AND ${whereData}
      WHERE m.status='ativo'
      GROUP BY m.id
      ORDER BY total DESC
    `).bind(...dateParams).all();

    // ── Receita por convênio ──
    const porConvenio = await env.DB.prepare(`
      SELECT categoria,
        COALESCE(SUM(CASE WHEN status!='cancelado' THEN valor ELSE 0 END),0) as total,
        COUNT(*) as qtd
      FROM lancamentos l
      WHERE tipo='receita' AND ${whereData}${whereExtra}
      GROUP BY categoria
      ORDER BY total DESC
    `).bind(...allParams).all();

    // ── Lançamentos detalhados ──
    const lancamentos = await env.DB.prepare(`
      SELECT l.*, m.nome as medico_nome, m.cor as medico_cor
      FROM lancamentos l
      LEFT JOIN medicos m ON m.id = l.medico_id
      WHERE ${whereData}${whereExtra}
      ORDER BY l.data DESC, l.criado_em DESC
    `).bind(...allParams).all();

    // ── Evolução diária (para gráfico) ──
    const evolucao = await env.DB.prepare(`
      SELECT date(data) as dia,
        COALESCE(SUM(CASE WHEN tipo='receita' AND status!='cancelado' THEN valor ELSE 0 END),0) as receita,
        COALESCE(SUM(CASE WHEN tipo='despesa' AND status!='cancelado' THEN valor ELSE 0 END),0) as despesa
      FROM lancamentos l
      WHERE ${whereData}${whereExtra}
      GROUP BY date(data)
      ORDER BY dia ASC
    `).bind(...allParams).all();

    return Response.json({
      ok: true,
      resumo,
      porMedico:   porMedico.results,
      porConvenio: porConvenio.results,
      lancamentos: lancamentos.results,
      evolucao:    evolucao.results
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const {
      tipo, categoria, descricao, valor, data,
      medico_id, agendamento_id, status, forma_pgto, observacoes
    } = await request.json();

    if (!tipo || !descricao || !valor || !data)
      return Response.json({ ok: false, error: 'Tipo, descrição, valor e data são obrigatórios' }, { status: 400 });

    const result = await env.DB.prepare(`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, medico_id, agendamento_id, status, forma_pgto, observacoes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(
      tipo, categoria || (tipo==='receita' ? 'Consulta' : 'Geral'),
      descricao, parseFloat(valor), data,
      medico_id || null, agendamento_id || null,
      status || 'confirmado',
      forma_pgto || 'dinheiro',
      observacoes || ''
    ).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
