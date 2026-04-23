// functions/api/_lib/auth.js
// Utilitários de autenticação para Cloudflare Workers (Web Crypto API)

// Hash de senha usando SHA-256 + salt
export async function hashSenha(senha) {
  const salt = 'clinicaapp_salt_2026';
  const data = new TextEncoder().encode(salt + senha);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gerar token único
export function gerarToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verificar token na requisição e retornar usuário
export async function verificarAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();

  if (!token) return { ok: false, status: 401, error: 'Token não fornecido' };

  const sessao = await env.DB.prepare(`
    SELECT s.*, u.id as uid, u.nome, u.email, u.perfil, u.medico_id, u.ativo
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_em > datetime('now') AND u.ativo = 1
  `).bind(token).first();

  if (!sessao) return { ok: false, status: 401, error: 'Sessão inválida ou expirada' };

  return {
    ok: true,
    usuario: {
      id: sessao.uid,
      nome: sessao.nome,
      email: sessao.email,
      perfil: sessao.perfil,
      medico_id: sessao.medico_id
    }
  };
}

// Verificar permissão por perfil
export function verificarPermissao(usuario, perfisPermitidos) {
  if (!perfisPermitidos.includes(usuario.perfil)) {
    return { ok: false, status: 403, error: 'Sem permissão para esta ação' };
  }
  return { ok: true };
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}
