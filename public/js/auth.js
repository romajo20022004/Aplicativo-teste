const AUTH_USERS = [
  {
    email: 'admin@clinica.com',
    password: '123456',
    role: 'admin',
    name: 'Administrador'
  },
  {
    email: 'medico@clinica.com',
    password: '123456',
    role: 'medico',
    name: 'Dr. Teste'
  },
  {
    email: 'secretaria@clinica.com',
    password: '123456',
    role: 'secretaria',
    name: 'Secretária'
  }
];

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('clinica_session') || 'null');
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem('clinica_session', JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem('clinica_session');
}

function redirectToApp() {
  window.location.href = '/';
}

function redirectToLogin() {
  window.location.href = '/login.html';
}

function showError(message) {
  const box = document.getElementById('error-box');
  if (!box) return;
  box.style.display = 'block';
  box.textContent = message;
}

function clearErrors() {
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'none';
    box.textContent = '';
  }

  const errEmail = document.getElementById('err-email');
  const errPassword = document.getElementById('err-password');

  if (errEmail) errEmail.textContent = '';
  if (errPassword) errPassword.textContent = '';
}

function validateLogin(email, password) {
  let ok = true;

  if (!email) {
    document.getElementById('err-email').textContent = 'E-mail é obrigatório';
    ok = false;
  }

  if (!password) {
    document.getElementById('err-password').textContent = 'Senha é obrigatória';
    ok = false;
  }

  return ok;
}

function authenticate(email, password) {
  return AUTH_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) || null;
}

document.addEventListener('DOMContentLoaded', () => {
  const existing = getSession();
  if (existing) {
    redirectToApp();
    return;
  }

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async () => {
    clearErrors();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!validateLogin(email, password)) return;

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    await new Promise(r => setTimeout(r, 500));

    const user = authenticate(email, password);

    btn.disabled = false;
    btn.textContent = 'Entrar no sistema';

    if (!user) {
      showError('Credenciais inválidas. Confira o e-mail e a senha de teste.');
      return;
    }

    setSession({
      email: user.email,
      role: user.role,
      name: user.name,
      loggedAt: new Date().toISOString()
    });

    redirectToApp();
  });
});
