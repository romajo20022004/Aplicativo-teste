const API_P = "/api/pacientes";
const API_A = "/api/agendamentos";

// -------- NAV --------
function mostrar(sec) {
  document.getElementById("pacientes").style.display = sec === "pacientes" ? "block" : "none";
  document.getElementById("agenda").style.display = sec === "agenda" ? "block" : "none";
}

// -------- PACIENTES --------
async function carregarPacientes() {
  const res = await fetch(API_P);
  const json = await res.json();

  const tbody = document.getElementById("lista-pacientes");
  tbody.innerHTML = "";

  json.data.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.telefone || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalPaciente() {
  document.getElementById("modal-paciente").style.display = "block";
}

async function salvarPaciente() {
  const body = {
    nome: document.getElementById("p-nome").value,
    telefone: document.getElementById("p-telefone").value
  };

  await fetch(API_P, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  document.getElementById("modal-paciente").style.display = "none";
  carregarPacientes();
}

// -------- AGENDA --------
async function carregarAgenda() {
  const data = document.getElementById("agenda-data").value;

  const res = await fetch(`${API_A}?data=${data}`);
  const json = await res.json();

  const tbody = document.getElementById("agenda-lista");
  tbody.innerHTML = "";

  json.data.forEach(a => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${a.hora}</td>
      <td>${a.paciente_nome}</td>
      <td>${a.status}</td>
      <td><button onclick="delAg(${a.id})">X</button></td>
    `;

    tbody.appendChild(tr);
  });
}

function abrirModalAg() {
  document.getElementById("modal").style.display = "block";
  carregarSelectPacientes();
}

async function carregarSelectPacientes() {
  const res = await fetch(API_P);
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

async function salvarAg() {
  const body = {
    paciente_id: document.getElementById("ag-paciente").value,
    data: document.getElementById("ag-data").value,
    hora: document.getElementById("ag-hora").value,
    status: document.getElementById("ag-status").value
  };

  await fetch(API_A, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  document.getElementById("modal").style.display = "none";
  carregarAgenda();
}

async function delAg(id) {
  await fetch(`${API_A}/${id}`, { method:"DELETE" });
  carregarAgenda();
}

// -------- INIT --------
document.getElementById("agenda-data").value =
  new Date().toISOString().split("T")[0];

carregarPacientes();
carregarAgenda();
