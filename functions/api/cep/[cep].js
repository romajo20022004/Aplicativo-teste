export async function onRequestGet({ params }) {
  try {
    const cep = params.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      return Response.json({ ok: false, error: 'CEP inválido' }, { status: 400 });
    }
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) {
      return Response.json({ ok: false, error: 'CEP não encontrado' }, { status: 404 });
    }
    return Response.json({
      ok: true,
      data: {
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf
      }
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
