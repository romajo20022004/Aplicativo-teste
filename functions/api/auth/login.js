// functions/api/auth/login.js
import { hashSenha, gerarToken, json } from '../_lib/auth.js';

export async function onRequestPost({ env, request }) {
  try {
    const { email, senha } = await request.json();
    if (!email || !senha)
      return json({ ok: false, error: 'E-mail e senha são obrigatórios' }, 400);

    const senhaHash = await hashSenha(senha);

    const usuario = await env.DB.prepare(
      'SELECT * FROM usuarios WHERE email = ? AND senha_hash = ? AND ativo = 1'
    ).bind(email.toLowerCase().trim(), senhaHash).first();

    if (!usuario)
      return json({ ok: false, error: 'E-mail ou senha incorretos' }, 401);

    // Criar sessão — expira em 8 horas
    const token = gerarToken();
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    await env.DB.prepare(
      'INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?,?,?)'
    ).bind(usuario.id, token, expira).run();

    // Limpar sessões antigas deste usuário
    await env.DB.prepare(
      "DELETE FROM sessoes WHERE usuario_id = ? AND expira_em < datetime('now')"
    ).bind(usuario.id).run();

    return json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        medico_id: usuario.medico_id
      }
    });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
