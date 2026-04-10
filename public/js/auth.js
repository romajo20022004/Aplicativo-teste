async function login() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const errorEl = document.getElementById('error');
  const btn = document.getElementById('btn-login');

  errorEl.innerText = '';

  if (!email || !senha) {
    errorEl.innerText = 'Preencha e-mail e senha';
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Entrando...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      errorEl.innerText = json.error || 'Falha no login';
      btn.disabled = false;
      btn.innerText = 'Entrar';
      return;
    }

    localStorage.setItem('session', JSON.stringify({
      token: json.token,
      user: json.user
    }));

    window.location.href = '/';
  } catch (e) {
    errorEl.innerText = 'Erro ao conectar com o servidor';
    btn.disabled = false;
    btn.innerText = 'Entrar';
  }
}
