const API_P = "/api/pacientes";
const API_A = "/api/agendamentos";

// -------- TOKEN --------
function getToken() {
  const s = JSON.parse(localStorage.getItem('session') || 'null');
  return s?.token || '';
}

function authHeader() {
  return {
    Authorization: 'Bearer ' + getToken()
  };
}

// -------- AUTH / PERFIL --------
function getPerfil() {
  return window.USER?.perfil || '';
}

function isAdmin() {
  return getPerfil() === 'admin';
}

function isMedico() {
  return getPerfil() === 'medico';
}

function isSecretaria() {
  return getPerfil() === 'secretaria';
}

function canDeletePaciente() {
  return isAdmin();
}

function canCreatePaciente() {
  return isAdmin() || isMedico() || isSecretaria();
}

function canCreateAgendamento() {
  return isAdmin() || isMedico() || isSecretaria();
}

function canDeleteAgendamento() {
  return isAdmin() || isSecretaria();
}

function canViewFinanceiro() {
  return isAdmin();
}

function applyAuth() {
  if (window.USER) {
    document.getElementById("user-info").innerText =
      window.USER.email + " (" + window.USER.perfil + ")";
  }

  const navFinanceiro = document.getElementById("nav-financeiro");
  if (navFinanceiro && !canViewFinanceiro()) {
    navFinanceiro.style.display = "none";
  }

  const btnNovoPaciente = document.getElementById("btn-novo-paciente");
  if (btnNovoPaciente && !canCreatePaciente()) {
    btnNovoPaciente.style.display = "none";
  }

  const btnNovoAgendamento = document.getElementById("btn-novo-agendamento");
  if (btnNovoAgendamento && !canCreateAgendamento()) {
    btnNovoAgendamento.style.display = "none";
  }
}

// -------- NAV --------
function mostrar(sec) {
  document.getElementById("pacientes").style.display =
    sec === "pacientes" ? "block" : "none";

  document.getElementById("agenda").style.display =
    sec === "agenda" ? "block" : "none";

  document.getElementById("financeiro").style.display =
    sec === "financeiro" ? "block" : "none";
}

// -------- PACIENTES --------
async function carregarPacientes() {
  const res = await fetch(API_P, {
    headers: authHeader()
  });

  const json = await res.json();
  const tbody = document.getElementById("lista-pacientes");
  tbody.innerHTML = "";

  if (!json.ok) {
    tbody.innerHTML = `<tr><td colspan="3">Erro: ${json.error || 'Falha ao carregar'}</td></tr>`;
    return;
  }

  if (!json.data || !json.data.length) {
    tbody.innerHTML = `<tr><td colspan="3">Nenhum paciente encontrado</td></tr>`;
    return;
  }

  json.data.forEach(p => {
    const tr = document.createElement("tr");

    const actionHtml = canDeletePaciente()
      ? `<button onclick="delPaciente(${p.id})">Excluir</button>`
      : `<span style="color:#888">Sem permissão</span>`;

    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.telefone || ""}</td>
      <td>${actionHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

function abrirModalPaciente() {
  if (!canCreatePaciente()) {
    alert("Seu perfil não pode cadastrar pacientes.");
    return;
  }
  document.getElementById("modal-paciente").style.display = "block";
}

function fecharModalPaciente() {
  document.getElementById("modal-paciente").style.display = "none";
}

async function salvarPaciente() {
  if (!canCreatePaciente()) {
    alert("Seu perfil não pode cadastrar pacientes.");
    return;
  }

  const nome = document.getElementById("p-nome").value.trim();
  const telefone = document.getElementById("p-telefone").value.trim();

  if (!nome || !telefone) {
    alert("Preencha nome e telefone.");
    return;
  }

  const body = {
    nome,
    nascimento: "2000-01-01",
    cpf: String(Date.now()).slice(-11),
    sexo: "M",
    telefone
  };

  const res = await fetch(API_P, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader()
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao cadastrar paciente");
    return;
  }

  document.getElementById("modal-paciente").style.display = "none";
  document.getElementById("p-nome").value = "";
  document.getElementById("p-telefone").value = "";

  carregarPacientes();
}

async function delPaciente(id) {
  if (!canDeletePaciente()) {
    alert("Seu perfil não pode excluir pacientes.");
    return;
  }

  const ok = confirm("Excluir paciente?");
  if (!ok) return;

  const res = await fetch(`/api/pacientes/${id}`, {
    method: "DELETE",
    headers: authHeader()
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao excluir paciente");
    return;
  }

  carregarPacientes();
}

// -------- AGENDA --------
async function carregarAgenda() {
  const data = document.getElementById("agenda-data").value;

  const res = await fetch(`${API_A}?data=${data}`, {
    headers: authHeader()
  });

  const json = await res.json();
  const tbody = document.getElementById("agenda-lista");
  tbody.innerHTML = "";

  if (!json.ok) {
    tbody.innerHTML = `<tr><td colspan="4">Erro: ${json.error || 'Falha ao carregar'}</td></tr>`;
    return;
  }

  if (!json.data || !json.data.length) {
    tbody.innerHTML = `<tr><td colspan="4">Nenhum agendamento encontrado</td></tr>`;
    return;
  }

  json.data.forEach(a => {
    const tr = document.createElement("tr");

    const actionHtml = canDeleteAgendamento()
      ? `<button onclick="delAg(${a.id})">Excluir</button>`
      : `<span style="color:#888">Sem permissão</span>`;

    tr.innerHTML = `
      <td>${a.hora}</td>
      <td>${a.paciente_nome}</td>
      <td>${a.status}</td>
      <td>${actionHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

function abrirModalAg() {
  if (!canCreateAgendamento()) {
    alert("Seu perfil não pode criar agendamentos.");
    return;
  }

  document.getElementById("modal").style.display = "block";
  carregarSelectPacientes();
  document.getElementById("ag-data").value = document.getElementById("agenda-data").value;
}

function fecharModalAg() {
  document.getElementById("modal").style.display = "none";
}

async function carregarSelectPacientes() {
  const res = await fetch(API_P, {
    headers: authHeader()
  });

  const json = await res.json();
  const select = document.getElementById("ag-paciente");
  select.innerHTML = "";

  if (!json.ok || !json.data) return;

  json.data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}

async function salvarAg() {
  if (!canCreateAgendamento()) {
    alert("Seu perfil não pode criar agendamentos.");
    return;
  }

  const body = {
    paciente_id: document.getElementById("ag-paciente").value,
    data: document.getElementById("ag-data").value,
    hora: document.getElementById("ag-hora").value,
    status: document.getElementById("ag-status").value
  };

  if (!body.paciente_id || !body.data || !body.hora) {
    alert("Preencha paciente, data e hora.");
    return;
  }

  const res = await fetch(API_A, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader()
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao criar agendamento");
    return;
  }

  document.getElementById("modal").style.display = "none";
  carregarAgenda();
}

async function delAg(id) {
  if (!canDeleteAgendamento()) {
    alert("Seu perfil não pode excluir agendamentos.");
    return;
  }

  const ok = confirm("Excluir agendamento?");
  if (!ok) return;

  const res = await fetch(`${API_A}/${id}`, {
    method: "DELETE",
    headers: authHeader()
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao excluir agendamento");
    return;
  }

  carregarAgenda();
}

// -------- INIT --------
document.getElementById("agenda-data").value =
  new Date().toISOString().split("T")[0];

applyAuth();
carregarPacientes();
carregarAgenda();
