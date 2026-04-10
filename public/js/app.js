const API_P = "/api/pacientes";
const API_A = "/api/agendamentos";
const API_M = "/api/medicos";

function getToken() {
  const s = JSON.parse(localStorage.getItem('session') || 'null');
  return s?.token || '';
}

function authHeader() {
  return {
    Authorization: 'Bearer ' + getToken()
  };
}

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

function mostrar(sec) {
  document.getElementById("pacientes").style.display =
    sec === "pacientes" ? "block" : "none";

  document.getElementById("agenda").style.display =
    sec === "agenda" ? "block" : "none";

  document.getElementById("financeiro").style.display =
    sec === "financeiro" ? "block" : "none";
}

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

  await carregarPacientes();
  await carregarPacientesNosSelects();
}

async function delPaciente(id) {
  if (!canDeletePaciente()) {
    alert("Seu perfil não pode excluir pacientes.");
    return;
  }

  if (!confirm("Excluir paciente?")) return;

  const res = await fetch(`/api/pacientes/${id}`, {
    method: "DELETE",
    headers: authHeader()
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao excluir paciente");
    return;
  }

  await carregarPacientes();
  await carregarPacientesNosSelects();
}

async function carregarMedicosNosSelects() {
  const res = await fetch(API_M, {
    headers: authHeader()
  });

  const json = await res.json();

  const filtro = document.getElementById("agenda-medico-filtro");
  const selectModal = document.getElementById("ag-medico");

  filtro.innerHTML = `<option value="">Todos os médicos</option>`;
  selectModal.innerHTML = `<option value="">Selecione um médico</option>`;

  if (!json.ok || !json.data) return;

  json.data.forEach(m => {
    const opt1 = document.createElement("option");
    opt1.value = m.id;
    opt1.textContent = m.nome;
    filtro.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = m.id;
    opt2.textContent = m.nome;
    selectModal.appendChild(opt2);
  });
}

async function carregarPacientesNosSelects() {
  const res = await fetch(API_P, {
    headers: authHeader()
  });

  const json = await res.json();
  const select = document.getElementById("ag-paciente");
  select.innerHTML = `<option value="">Selecione um paciente</option>`;

  if (!json.ok || !json.data) return;

  json.data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}

async function carregarAgenda() {
  const data = document.getElementById("agenda-data").value;
  const medicoId = document.getElementById("agenda-medico-filtro").value;

  let url = `${API_A}?data=${encodeURIComponent(data)}`;
  if (medicoId) {
    url += `&medico_id=${encodeURIComponent(medicoId)}`;
  }

  const res = await fetch(url, {
    headers: authHeader()
  });

  const json = await res.json();
  const tbody = document.getElementById("agenda-lista");
  tbody.innerHTML = "";

  if (!json.ok) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${json.error || 'Falha ao carregar'}</td></tr>`;
    return;
  }

  if (!json.data || !json.data.length) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum agendamento encontrado</td></tr>`;
    return;
  }

  json.data.forEach(a => {
    const tr = document.createElement("tr");

    const actionHtml = canDeleteAgendamento()
      ? `<button onclick="delAg(${a.id})">Excluir</button>`
      : `<span style="color:#888">Sem permissão</span>`;

    tr.innerHTML = `
      <td>${a.hora || ""}</td>
      <td>${a.paciente_nome || ""}</td>
      <td>${a.medico_nome || ""}</td>
      <td>${a.status || ""}</td>
      <td>${actionHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

async function abrirModalAg() {
  if (!canCreateAgendamento()) {
    alert("Seu perfil não pode criar agendamentos.");
    return;
  }

  await carregarPacientesNosSelects();
  await carregarMedicosNosSelects();

  document.getElementById("ag-data").value = document.getElementById("agenda-data").value;
  document.getElementById("ag-hora").value = "";
  document.getElementById("ag-status").value = "agendado";

  const filtroMedico = document.getElementById("agenda-medico-filtro").value;
  if (filtroMedico) {
    document.getElementById("ag-medico").value = filtroMedico;
  }

  document.getElementById("modal").style.display = "block";
}

function fecharModalAg() {
  document.getElementById("modal").style.display = "none";
}

async function salvarAg() {
  if (!canCreateAgendamento()) {
    alert("Seu perfil não pode criar agendamentos.");
    return;
  }

  const body = {
    paciente_id: document.getElementById("ag-paciente").value,
    medico_id: document.getElementById("ag-medico").value,
    data: document.getElementById("ag-data").value,
    hora: document.getElementById("ag-hora").value,
    status: document.getElementById("ag-status").value
  };

  if (!body.paciente_id || !body.medico_id || !body.data || !body.hora) {
    alert("Preencha paciente, médico, data e hora.");
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
  await carregarAgenda();
}

async function delAg(id) {
  if (!canDeleteAgendamento()) {
    alert("Seu perfil não pode excluir agendamentos.");
    return;
  }

  if (!confirm("Excluir agendamento?")) return;

  const res = await fetch(`${API_A}/${id}`, {
    method: "DELETE",
    headers: authHeader()
  });

  const json = await res.json();

  if (!json.ok) {
    alert(json.error || "Erro ao excluir agendamento");
    return;
  }

  await carregarAgenda();
}

document.getElementById("agenda-data").value =
  new Date().toISOString().split("T")[0];

document.getElementById("agenda-data").addEventListener("change", carregarAgenda);
document.getElementById("agenda-medico-filtro").addEventListener("change", carregarAgenda);

applyAuth();

(async function init() {
  await carregarMedicosNosSelects();
  await carregarPacientes();
  await carregarPacientesNosSelects();
  await carregarAgenda();
})();
