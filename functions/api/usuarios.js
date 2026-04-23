// functions/api/usuarios.js
import { hashSenha, verificarAuth, verificarPermissao, json } from './_lib/auth.js';

export async function onRequestGet({ env, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const perm = verificarPermissao(auth.usuario, ['admin']);
    if (!perm.ok) return json({ ok: false, error: perm.error }, perm.status);

    const result = await env.DB.prepare(
      'SELECT id, nome, email, perfil, medico_id, ativo, criado_em FROM usuarios ORDER BY nome ASC'
    ).all();
    return json({ ok: true, data: result.results });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const auth = await verificarAuth(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const perm = verificarPermissao(auth.usuario, ['admin']);
    if (!perm.ok) return json({ ok: false, error: perm.error }, perm.status);

    const { nome, email, senha, perfil, medico_id } = await request.json();
    if (!nome || !email || !senha || !perfil)
      return json({ ok: false, error: 'Campos obrigatórios faltando' }, 400);

    const senhaHash = await hashSenha(senha);
    const result = await env.DB.prepare(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil, medico_id) VALUES (?,?,?,?,?)'
    ).bind(nome, email.toLowerCase().trim(), senhaHash, perfil, medico_id || null).run();

    return json({ ok: true, id: result.meta.last_row_id }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return json({ ok: false, error: 'E-mail já cadastrado' }, 409);
    return json({ ok: false, error: e.message }, 500);
  }
}
