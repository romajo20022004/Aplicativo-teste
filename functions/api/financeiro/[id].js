// functions/api/financeiro/[id].js
export async function onRequestGet({ env, params }) {
  try {
    const row = await env.DB.prepare(
      'SELECT l.*, m.nome as medico_nome FROM lancamentos l LEFT JOIN medicos m ON m.id=l.medico_id WHERE l.id=?'
    ).bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });
    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ env, params, request }) {
  try {
    const { tipo, categoria, descricao, valor, data, medico_id, status, forma_pgto, observacoes } = await request.json();
    await env.DB.prepare(`
      UPDATE lancamentos SET tipo=?, categoria=?, descricao=?, valor=?, data=?,
        medico_id=?, status=?, forma_pgto=?, observacoes=?
      WHERE id=?
    `).bind(
      tipo, categoria, descricao, parseFloat(valor), data,
      medico_id||null, status||'confirmado', forma_pgto||'dinheiro', observacoes||'',
      params.id
    ).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM lancamentos WHERE id=?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
