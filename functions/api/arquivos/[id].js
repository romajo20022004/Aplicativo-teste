// functions/api/arquivos/[id].js
export async function onRequestGet({ env, params, request }) {
  try {
    const url = new URL(request.url);
    const download = url.searchParams.get('download') === '1';

    const row = await env.DB.prepare('SELECT * FROM arquivos WHERE id = ?')
      .bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });

    // Se pedir o arquivo, buscar do R2 e retornar
    if (download) {
      const obj = await env.FILES_BUCKET.get(row.nome_storage);
      if (!obj) return Response.json({ ok: false, error: 'Arquivo não encontrado no storage' }, { status: 404 });

      return new Response(obj.body, {
        headers: {
          'Content-Type': row.tipo_mime,
          'Content-Disposition': `inline; filename="${row.nome_original}"`,
          'Cache-Control': 'private, max-age=3600'
        }
      });
    }

    return Response.json({ ok: true, data: row });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    const row = await env.DB.prepare('SELECT nome_storage FROM arquivos WHERE id = ?')
      .bind(params.id).first();
    if (!row) return Response.json({ ok: false, error: 'Não encontrado' }, { status: 404 });

    // Remover do R2
    await env.FILES_BUCKET.delete(row.nome_storage);

    // Remover do banco
    await env.DB.prepare('DELETE FROM arquivos WHERE id = ?').bind(params.id).run();

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
