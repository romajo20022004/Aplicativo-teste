// functions/api/usuarios/[id].js

async function hashSenha(senha) {
  const salt = 'clinicaapp_salt_2026';
  const data = new TextEncoder().encode(salt + senha);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPut({ env, params, request }) {
  try {
    const { nome, email, senha, perfil, medico_id, ativo } = await request.json();
    if (senha) {
      const senhaHash = await hashSenha(senha);
      await env.DB.prepare(
        'UPDATE usuarios SET nome=?, email=?, senha_hash=?, perfil=?, medico_id=?, ativo=? WHERE id=?'
      ).bind(nome, email.toLowerCase().trim(), senhaHash, perfil, medico_id||null, ativo??1, params.id).run();
    } else {
      await env.DB.prepare(
        'UPDATE usuarios SET nome=?, email=?, perfil=?, medico_id=?, ativo=? WHERE id=?'
      ).bind(nome, email.toLowerCase().trim(), perfil, medico_id||null, ativo??1, params.id).run();
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return Response.json({ ok: false, error: 'E-mail já cadastrado' }, { status: 409 });
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    await env.DB.prepare('DELETE FROM usuarios WHERE id=?').bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
