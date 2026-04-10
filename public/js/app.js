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

function applyAuth() {
  if (window.USER) {
    document.getElementById("user-info").innerText =
      window.USER.email + " (" + window.USER.perfil + ")";
  }
}

// ================= PACIENTES =================
async function carregarPacientes() {

  const res = await fetch(API_P, {
    headers: authHeader()
  });

  const json = await res.json();

  const tbody = document.getElementById("lista-pacientes");
  tbody.innerHTML = "";

  if (!json.ok) {
    alert("Erro pacientes: " + json.error);
    return;
  }

  json.data.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.telefone || ""}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= MEDICOS =================
async function carregarMedicos() {

  const res = await fetch(API_M, {
    headers: authHeader()
  });

  const json = await res.json();

  console.log("MEDICOS:", json);

  const select = document.getElementById("ag-medico");
  const filtro = document.getElementById("agenda-medico-filtro");

  select.innerHTML = "";
  filtro.innerHTML = "<option value=''>Todos</option>";

  if (!json.ok) {
    alert("Erro médicos: " + json.error);
    return;
  }

  json.data.forEach(m => {

    const o1 = document.createElement("option");
    o1.value = m.id;
    o1.textContent = m.nome;
    select.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = m.id;
    o2.textContent = m.nome;
    filtro.appendChild(o2);
  });
}

// ================= PACIENTES SELECT =================
async function carregarPacientesSelect() {

  const res = await fetch(API_P, {
    headers: authHeader()
  });

  const json = await res.json();

  const select = document.getElementById("ag-paciente");
  select.innerHTML = "";

  json.data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}

// ================= AGENDA =================
async function carregarAgenda() {

  const data = document.getElementById("agenda-data").value;
  const medico = document.getElementById("agenda-medico-filtro").value;

  let url = `${API_A}?data=${data}`;
  if (medico) url += `&medico_id=${medico}`;

  const res = await fetch(url, {
    headers: authHeader()
  });

  const json = await res.json();

  console.log("AGENDA:", json);

  const tbody = document.getElementById("agenda-lista");
  tbody.innerHTML = "";

  if (!json.ok) {
    alert("Erro agenda: " + json.error);
    return;
  }

  json.data.forEach(a => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${a.hora}</td>
      <td>${a.paciente_nome}</td>
      <td>${a.medico_nome}</td>
      <td>${a.status}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= MODAL =================
async function abrirModalAg() {
  await carregarPacientesSelect();
  await carregarMedicos();

  document.getElementById("modal").style.display = "block";
}

function fecharModalAg() {
  document.getElementById("modal").style.display = "none";
}

// ================= SALVAR =================
async function salvarAg() {

  const body = {
    paciente_id: document.getElementById("ag-paciente").value,
    medico_id: document.getElementById("ag-medico").value,
    data: document.getElementById("ag-data").value,
    hora: document.getElementById("ag-hora").value,
    status: document.getElementById("ag-status").value
  };

  console.log("ENVIANDO:", body);

  const res = await fetch(API_A, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader()
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  console.log("RESPOSTA:", json);

  if (!json.ok) {
    alert("ERRO AO SALVAR: " + json.error);
    return;
  }

  alert("Agendamento criado!");

  document.getElementById("modal").style.display = "none";

  carregarAgenda();
}

// ================= INIT =================
document.getElementById("agenda-data").value =
  new Date().toISOString().split("T")[0];

applyAuth();

(async function () {
  await carregarPacientes();
  await carregarMedicos();
  await carregarAgenda();
})();
