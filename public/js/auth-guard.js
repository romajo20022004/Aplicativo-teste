function getClinicaSession() {
  try {
    return JSON.parse(localStorage.getItem('clinica_session') || 'null');
  } catch {
    return null;
  }
}

function logoutClinica() {
  localStorage.removeItem('clinica_session');
  window.location.href = '/login.html';
}

(function () {
  const session = getClinicaSession();

  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  window.CLINICA_SESSION = session;
  window.logoutClinica = logoutClinica;
})();
