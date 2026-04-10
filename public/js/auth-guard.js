async function logout() {
  try {
    const raw = localStorage.getItem('session');
    const session = raw ? JSON.parse(raw) : null;

    if (session && session.token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.token
        }
      });
    }
  } catch (_) {
  }

  localStorage.removeItem('session');
  window.location.href = '/login.html';
}

(async function () {
  try {
    const raw = localStorage.getItem('session');
    const session = raw ? JSON.parse(raw) : null;

    if (!session || !session.token) {
      window.location.href = '/login.html';
      return;
    }

    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': 'Bearer ' + session.token
      }
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      localStorage.removeItem('session');
      window.location.href = '/login.html';
      return;
    }

    window.USER = json.user;
    window.AUTH_TOKEN = session.token;
  } catch (e) {
    localStorage.removeItem('session');
    window.location.href = '/login.html';
  }
})();
