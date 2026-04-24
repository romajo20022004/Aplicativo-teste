// public/js/app.js

// ── Estado global ──────────────────────────────────────────────
const state = {
  pacientes: [], medicos: [], agendamentos: [],
  editingId: null, editingType: null, role: 'admin',
  agendaDate: new Date().toISOString().slice(0, 10)
};

// ── Utilitários ────────────────────────────────────────────────
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function fmt_date(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmt_brl(val) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmt_time(dt) {
  if (!dt) return '';
  return dt.includes('T') ? dt.slice(11, 16) : dt.slice(11, 16);
}

function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatarColor(name) {
  const colors = ['av-blue', 'av-teal', 'av-coral', 'av-amber'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function maskCPF(v) { return v.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2').slice(0,14); }
function maskPhone(v) { v=v.replace(/\D/g,'').slice(0,11); if(v.length<=10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').trim().replace(/-$/,''); return v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'); }
function maskCEP(v) { return v.replace(/\D/g,'').replace(/(\d{5})(\d{1,3})/,'$1-$2').slice(0,9); }

function dateLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const hoje = new Date().toISOString().slice(0,10);
  const amanha = new Date(Date.now()+86400000).toISOString().slice(0,10);
  const ontem  = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const label = iso === hoje ? ' (Hoje)' : iso === amanha ? ' (Amanhã)' : iso === ontem ? ' (Ontem)' : '';
  return d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) + label;
}

// ── API ───────────────────────────────────────────────────────
// ── Auth ──────────────────────────────────────────────────────
const auth = {
  token: localStorage.getItem('clinica_token'),
  usuario: JSON.parse(localStorage.getItem('clinica_usuario') || 'null')
};

function apiHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token || ''}` };
}

async function login(email, senha) {
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  btn.disabled = true; btn.innerHTML = '<div class="spinner" style="border-top-color:#fff"></div>';
  const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,senha}) });
  const data = await res.json();
  btn.disabled = false; btn.textContent = 'Entrar';
  if (!data.ok) { err.textContent = data.error || 'E-mail ou senha incorretos'; return; }
  auth.token = data.token; auth.usuario = data.usuario;
  localStorage.setItem('clinica_token', data.token);
  localStorage.setItem('clinica_usuario', JSON.stringify(data.usuario));
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  iniciarApp();
}

function logout() {
  if (auth.token) fetch('/api/auth/logout', { method:'POST', headers:apiHeaders() });
  auth.token = null; auth.usuario = null;
  localStorage.removeItem('clinica_token');
  localStorage.removeItem('clinica_usuario');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  document.getElementById('login-error').textContent = '';
}

function aplicarPermissoes() {
  if (!auth.usuario) return;
  const p = auth.usuario.perfil;
  document.getElementById('user-nome').textContent = auth.usuario.nome;
  const av = document.getElementById('user-avatar');
  if(av) { const parts = auth.usuario.nome.split(' '); av.textContent = parts.slice(0,2).map(w=>w[0].toUpperCase()).join(''); }
  document.getElementById('user-perfil').textContent = p.charAt(0).toUpperCase() + p.slice(1);
  const finNav = document.getElementById('nav-financeiro');
  const medNav = document.getElementById('nav-medicos');
  const usrNav = document.getElementById('nav-usuarios');
  if (p === 'medico') {
    if (finNav) finNav.style.display = 'none';
    if (medNav) medNav.style.display = 'none';
    if (usrNav) usrNav.style.display = 'none';
  } else if (p === 'secretaria') {
    if (finNav) finNav.style.display = 'none';
    if (usrNav) usrNav.style.display = 'none';
  }
}

function iniciarApp() {
  aplicarPermissoes();
  const p = auth.usuario?.perfil;
  navTo(p === 'medico' || p === 'secretaria' ? 'agenda' : 'pacientes');
  loadMedicos();
}

const API = {
  async get(path) {
    const r = await fetch(path, { headers: apiHeaders() });
    const d = await r.json();
    if (r.status === 401) { logout(); return d; }
    return d;
  },
  async post(path, body) {
    const r = await fetch(path, { method:'POST', headers:apiHeaders(), body:JSON.stringify(body) });
    const d = await r.json();
    if (r.status === 401 && !path.includes('/auth/')) { logout(); return d; }
    return d;
  },
  async put(path, body) {
    const r = await fetch(path, { method:'PUT', headers:apiHeaders(), body:JSON.stringify(body) });
    const d = await r.json();
    if (r.status === 401) { logout(); return d; }
    return d;
  },
  async del(path) {
    const r = await fetch(path, { method:'DELETE', headers:apiHeaders() });
    const d = await r.json();
    if (r.status === 401) { logout(); return d; }
    return d;
  }
};

// ── Navegação ──────────────────────────────────────────────────
const PAGES = {
  pacientes:  { title:'Pacientes',  addBtn:'+ Novo Paciente',    showSearch:true  },
  medicos:    { title:'Médicos',    addBtn:'+ Novo Médico',       showSearch:false },
  agenda:     { title:'Agenda',     addBtn:'+ Novo Agendamento',  showSearch:false },
  financeiro: { title:'Financeiro', addBtn:'',                    showSearch:false },
  dashboard:  { title:'Dashboard',  addBtn:'',                    showSearch:false }
};

function navTo(page) {
  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('sec-'+page);
  const btn = document.getElementById('nav-'+page);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  const cfg = PAGES[page] || {};
  $('#topbar-title').textContent = cfg.title || page;
  const addBtn = $('#btn-add');
  addBtn.textContent = cfg.addBtn || '';
  addBtn.style.display = cfg.addBtn ? '' : 'none';
  const search = $('#search-input');
  search.style.display = cfg.showSearch ? '' : 'none';
  if (!cfg.showSearch) search.value = '';
  if (page === 'pacientes') { loadPacientes(); }
  if (page === 'medicos')   { loadMedicos(); }
  if (page === 'agenda')    { loadAgenda(); }
}

// ══════════════════════════════════════════════
// PACIENTES
// ══════════════════════════════════════════════
async function loadPacientes() {
  const q = $('#search-input').value;
  const status = $('#filter-status') ? $('#filter-status').value : '';
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const res = await API.get('/api/pacientes?' + params);
  if (!res.ok) { toast('Erro ao carregar pacientes', 'error'); return; }
  state.pacientes = res.data;
  renderPacientes();
  renderMetricasPacientes();
}

function renderPacientes() {
  const tbody = $('#pac-tbody');
  if (!state.pacientes.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">Nenhum paciente encontrado</td></tr>'; return; }
  tbody.innerHTML = state.pacientes.map(p => `
    <tr>
      <td><div class="flex-row"><div class="av ${avatarColor(p.nome)}">${initials(p.nome)}</div><div><div style="font-weight:500">${p.nome}</div><div style="font-size:11px;color:var(--sub)">${p.cpf}</div></div></div></td>
      <td>${fmt_date(p.nascimento)}</td>
      <td>${p.telefone}<br><span style="font-size:11px;color:var(--sub)">${p.email||''}</span></td>
      <td><span class="badge ${convenioBadge(p.convenio)}">${p.convenio}</span></td>
      <td style="font-weight:500">${fmt_brl(p.valor_consulta)}</td>
      <td><span class="badge ${p.status==='ativo'?'badge-teal':'badge-red'}">${p.status==='ativo'?'Ativo':'Inativo'}</span></td>
      <td><div class="flex-row">
        <button class="btn btn-sm" onclick="abrirProntuario(${p.id})" title="Prontuário" style="background:var(--teal-light);color:var(--teal);border-color:transparent">📋 Prontuário</button>
        <button class="btn btn-sm" onclick="editPaciente(${p.id})">✎ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeletePaciente(${p.id},'${p.nome.replace(/'/g,"\\'")}')">🗑</button>
      </div></td>
    </tr>`).join('');
}

function renderMetricasPacientes() {
  const total = state.pacientes.length;
  const ativos = state.pacientes.filter(p=>p.status==='ativo').length;
  const inativos = state.pacientes.filter(p=>p.status==='inativo').length;
  const ticket = total ? state.pacientes.reduce((s,p)=>s+(p.valor_consulta||0),0)/total : 0;
  const el = id => document.getElementById(id);
  if(el('m-total'))   el('m-total').textContent   = total;
  if(el('m-ativos'))  el('m-ativos').textContent  = ativos;
  if(el('m-inativos'))el('m-inativos').textContent= inativos;
  if(el('m-ticket'))  el('m-ticket').textContent  = fmt_brl(ticket);
}

function convenioBadge(c) {
  const map={Particular:'badge-blue',Unimed:'badge-teal','Bradesco Saúde':'badge-amber','SulAmérica':'badge-coral',Amil:'badge-green'};
  return map[c]||'badge-blue';
}

// Modal paciente
function openModal(title) { $('#modal-title').textContent=title; $('#modal-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal() { $('#modal-overlay').classList.remove('open'); document.body.style.overflow=''; state.editingId=null; state.editingType=null; resetForm('#pac-form'); }

function resetForm(sel) {
  const form = $(sel);
  if(!form) return;
  form.reset();
  $$('.field-error', form).forEach(e=>e.textContent='');
  $$('.error', form).forEach(e=>e.classList.remove('error'));
}

function newPaciente() { state.editingId=null; state.editingType='paciente'; resetForm('#pac-form'); openModal('Novo Paciente'); setTimeout(()=>$('#f-nome').focus(),100); }

async function editPaciente(id) {
  const res = await API.get('/api/pacientes/'+id);
  if(!res.ok) { toast('Erro ao carregar','error'); return; }
  const p = res.data; state.editingId=id; state.editingType='paciente';
  ['nome','nascimento','cpf','sexo','telefone','email','cep','logradouro','numero','complemento','bairro','cidade'].forEach(f=>{ const el=document.getElementById('f-'+f); if(el) el.value=p[f]||''; });
  $('#f-estado').value=p.estado||'';
  $('#f-convenio').value=p.convenio||'Particular';
  $('#f-num-carteira').value=p.num_carteira||'';
  $('#f-valor').value=p.valor_consulta||'';
  $('#f-status').value=p.status||'ativo';
  $('#f-obs').value=p.observacoes||'';
  openModal('Editar Paciente — '+p.nome);
}

async function savePaciente() {
  const data = {
    nome:$('#f-nome').value.trim(), nascimento:$('#f-nascimento').value, cpf:$('#f-cpf').value.trim(),
    sexo:$('#f-sexo').value, telefone:$('#f-telefone').value.trim(), email:$('#f-email').value.trim(),
    cep:$('#f-cep').value.trim(), logradouro:$('#f-logradouro').value.trim(), numero:$('#f-numero').value.trim(),
    complemento:$('#f-complemento').value.trim(), bairro:$('#f-bairro').value.trim(),
    cidade:$('#f-cidade').value.trim(), estado:$('#f-estado').value,
    convenio:$('#f-convenio').value, num_carteira:$('#f-num-carteira').value.trim(),
    valor_consulta:parseFloat($('#f-valor').value)||0, status:$('#f-status').value, observacoes:$('#f-obs').value.trim()
  };
  if(!data.nome||!data.nascimento||!data.cpf||!data.sexo||!data.telefone) { toast('Preencha os campos obrigatórios','error'); return; }
  const btn = $('#btn-save'); btn.disabled=true; btn.innerHTML='<div class="spinner"></div>';
  const res = state.editingId ? await API.put('/api/pacientes/'+state.editingId,data) : await API.post('/api/pacientes',data);
  btn.disabled=false; btn.textContent='Salvar';
  if(!res.ok) { toast(res.error||'Erro ao salvar','error'); return; }
  toast(state.editingId?'Paciente atualizado!':'Paciente cadastrado!');
  closeModal(); loadPacientes();
}

async function confirmDeletePaciente(id, nome) {
  if(!confirm(`Excluir "${nome}"?`)) return;
  const res = await API.del('/api/pacientes/'+id);
  if(!res.ok) { toast('Erro ao excluir','error'); return; }
  toast('Paciente excluído'); loadPacientes();
}

async function lookupCEP(cep) {
  const raw = cep.replace(/\D/g,'');
  if(raw.length!==8) return;
  const res = await API.get('/api/cep/'+raw);
  if(!res.ok) { toast('CEP não encontrado','error'); return; }
  $('#f-logradouro').value=res.data.logradouro||'';
  $('#f-bairro').value=res.data.bairro||'';
  $('#f-cidade').value=res.data.cidade||'';
  $('#f-estado').value=res.data.estado||'';
  $('#f-numero').focus();
}

// ══════════════════════════════════════════════
// MÉDICOS
// ══════════════════════════════════════════════
async function loadMedicos() {
  const res = await API.get('/api/medicos');
  if(!res.ok) { toast('Erro ao carregar médicos','error'); return; }
  state.medicos = res.data;
  renderMedicos();
}

function renderMedicos() {
  const tbody = $('#med-tbody');
  if(!tbody) return;
  if(!state.medicos.length) { tbody.innerHTML='<tr><td colspan="6" class="tbl-empty">Nenhum médico cadastrado</td></tr>'; return; }
  tbody.innerHTML = state.medicos.map(m=>`
    <tr>
      <td><div class="flex-row">
        <div class="av" style="background:${m.cor}22;color:${m.cor};font-size:11px">${initials(m.nome)}</div>
        <div><div style="font-weight:500">${m.nome}</div><div style="font-size:11px;color:var(--sub)">${m.crm}</div></div>
      </div></td>
      <td><span class="badge badge-blue">${m.especialidade}</span></td>
      <td>${m.telefone||'—'}</td>
      <td>${m.email||'—'}</td>
      <td><div class="flex-row" style="gap:6px"><div style="width:14px;height:14px;border-radius:50%;background:${m.cor}"></div><span style="font-size:11px">${m.cor}</span></div></td>
      <td><span class="badge ${m.status==='ativo'?'badge-teal':'badge-red'}">${m.status==='ativo'?'Ativo':'Inativo'}</span></td>
      <td><div class="flex-row">
        <button class="btn btn-sm" onclick="editMedico(${m.id})">✎ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteMedico(${m.id},'${m.nome.replace(/'/g,"\\'")}')">🗑</button>
      </div></td>
    </tr>`).join('');

  // Atualizar selects de médico nos formulários
  const selects = $$('select.medico-select');
  selects.forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">Selecione o médico...</option>' +
      state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
    sel.value = val;
  });
}

function newMedico() { state.editingId=null; state.editingType='medico'; resetForm('#med-form'); openModalMedico('Novo Médico'); }

function openModalMedico(title) { $('#modal-med-title').textContent=title; $('#modal-med-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModalMedico() { $('#modal-med-overlay').classList.remove('open'); document.body.style.overflow=''; state.editingId=null; }

async function editMedico(id) {
  const res = await API.get('/api/medicos/'+id);
  if(!res.ok) { toast('Erro','error'); return; }
  const m=res.data; state.editingId=id; state.editingType='medico';
  $('#fm-nome').value=m.nome||''; $('#fm-crm').value=m.crm||'';
  $('#fm-especialidade').value=m.especialidade||''; $('#fm-telefone').value=m.telefone||'';
  $('#fm-email').value=m.email||''; $('#fm-cor').value=m.cor||'#378ADD';
  $('#fm-status').value=m.status||'ativo';
  openModalMedico('Editar Médico — '+m.nome);
}

async function saveMedico() {
  const data = {
    nome:$('#fm-nome').value.trim(), crm:$('#fm-crm').value.trim(),
    especialidade:$('#fm-especialidade').value.trim(), telefone:$('#fm-telefone').value.trim(),
    email:$('#fm-email').value.trim(), cor:$('#fm-cor').value,
    status:$('#fm-status').value
  };
  if(!data.nome||!data.crm||!data.especialidade) { toast('Nome, CRM e especialidade são obrigatórios','error'); return; }
  const btn=$('#btn-save-med'); btn.disabled=true; btn.innerHTML='<div class="spinner"></div>';
  const res = state.editingId ? await API.put('/api/medicos/'+state.editingId,data) : await API.post('/api/medicos',data);
  btn.disabled=false; btn.textContent='Salvar';
  if(!res.ok) { toast(res.error||'Erro ao salvar','error'); return; }
  toast(state.editingId?'Médico atualizado!':'Médico cadastrado!');
  closeModalMedico(); loadMedicos();
}

async function confirmDeleteMedico(id, nome) {
  if(!confirm(`Excluir Dr(a). "${nome}"?`)) return;
  const res = await API.del('/api/medicos/'+id);
  if(!res.ok) { toast('Erro ao excluir','error'); return; }
  toast('Médico excluído'); loadMedicos();
}

// ══════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════
async function loadAgenda() {
  if(!state.medicos.length) await loadMedicos();
  if(!state.pacientes.length) await loadPacientes();
  $('#agenda-date-label').textContent = dateLabel(state.agendaDate);
  $('#agenda-date-input').value = state.agendaDate;

  const res = await API.get('/api/agendamentos?data='+state.agendaDate);
  if(!res.ok) { toast('Erro ao carregar agenda','error'); return; }
  state.agendamentos = res.data;
  renderAgenda();
}

function renderAgenda() {
  const container = $('#agenda-cols');
  if(!container) return;
  const medAtivos = state.medicos.filter(m=>m.status==='ativo');
  if(!medAtivos.length) { container.innerHTML='<div class="coming-soon"><p>Nenhum médico ativo cadastrado</p></div>'; return; }

  const horas = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                 '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
                 '17:00','17:30','18:00'];

  container.innerHTML = medAtivos.map(med => {
    const agendMed = state.agendamentos.filter(a=>a.medico_id===med.id);
    const slots = horas.map(h => {
      const ag = agendMed.find(a=>a.hora===h);
      if(ag) {
        const statusColor = { agendado:'#185FA5', confirmado:'#0F6E56', realizado:'#3B6D11', cancelado:'#A32D2D', faltou:'#854F0B' };
        const pgtoColor   = { pendente:'#854F0B', pago:'#0F6E56', convênio:'#185FA5', isento:'#888' };
        return `<div class="slot-card" style="border-left-color:${statusColor[ag.status_agenda]||'#185FA5'}">
          <div class="slot-name">${ag.paciente_nome}</div>
          <div class="slot-info">${ag.tipo} · ${ag.duracao_min}min</div>
          <div class="slot-footer">
            <span class="slot-badge" style="background:${statusColor[ag.status_agenda]}22;color:${statusColor[ag.status_agenda]}">${ag.status_agenda}</span>
            <span class="slot-badge" style="background:${pgtoColor[ag.status_pgto]}22;color:${pgtoColor[ag.status_pgto]}">${ag.status_pgto}</span>
            <span style="font-size:10px;color:var(--sub);margin-left:auto">${fmt_brl(ag.valor)}</span>
          </div>
          <div class="slot-actions">
            <button class="btn btn-sm" style="padding:2px 7px;font-size:10px" onclick="editAgendamento(${ag.id})">✎</button>
            <button class="btn btn-sm btn-danger" style="padding:2px 7px;font-size:10px" onclick="confirmDeleteAgendamento(${ag.id})">🗑</button>
          </div>
        </div>`;
      }
      return `<div class="slot-empty" onclick="novoAgendamentoHorario('${med.id}','${h}')">+</div>`;
    });

    return `<div class="agenda-col">
      <div class="agenda-col-header" style="border-top:3px solid ${med.cor}">
        <div class="av" style="background:${med.cor}22;color:${med.cor};font-size:11px;width:28px;height:28px">${initials(med.nome)}</div>
        <div><div style="font-size:12px;font-weight:500">${med.nome}</div><div style="font-size:10px;color:var(--sub)">${med.especialidade}</div></div>
        <span style="margin-left:auto;font-size:10px;font-weight:500;color:${med.cor}">${agendMed.filter(a=>a.status_agenda!=='cancelado').length} consult.</span>
      </div>
      <div class="agenda-slots">
        ${horas.map((h,i)=>`
          <div class="agenda-row">
            <div class="agenda-hora">${h}</div>
            <div class="agenda-slot">${slots[i]}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function novoAgendamentoHorario(medicoId, hora) {
  newAgendamento();
  setTimeout(() => {
    $('#fa-medico').value = medicoId;
    $('#fa-data').value = state.agendaDate;
    $('#fa-hora').value = hora;
  }, 50);
}

function newAgendamento() {
  state.editingId=null; state.editingType='agendamento';
  resetForm('#ag-form');
  $('#fa-data').value = state.agendaDate;
  // Popular selects
  $('#fa-paciente').innerHTML = '<option value="">Selecione o paciente...</option>' +
    state.pacientes.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  $('#fa-medico').innerHTML = '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  openModalAgendamento('Novo Agendamento');
}

function openModalAgendamento(title) { $('#modal-ag-title').textContent=title; $('#modal-ag-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModalAgendamento() { $('#modal-ag-overlay').classList.remove('open'); document.body.style.overflow=''; state.editingId=null; }

// Ao selecionar paciente, preencher valor automaticamente
function onPacienteSelect(val) {
  const pac = state.pacientes.find(p=>p.id==val);
  if(pac && !$('#fa-valor').value) $('#fa-valor').value = pac.valor_consulta||'';
}

async function editAgendamento(id) {
  const res = await API.get('/api/agendamentos/'+id);
  if(!res.ok) { toast('Erro','error'); return; }
  const a=res.data; state.editingId=id; state.editingType='agendamento';
  $('#fa-paciente').innerHTML = '<option value="">Selecione o paciente...</option>' +
    state.pacientes.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  $('#fa-medico').innerHTML = '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  state._agendamentoStatusAnterior = a.status_agenda;
  $('#fa-paciente').value = a.paciente_id;
  $('#fa-medico').value   = a.medico_id;
  $('#fa-data').value     = a.data;
  $('#fa-hora').value     = a.hora;
  $('#fa-duracao').value  = a.duracao_min;
  $('#fa-tipo').value     = a.tipo;
  $('#fa-valor').value    = a.valor;
  $('#fa-pgto').value     = a.status_pgto;
  $('#fa-status').value   = a.status_agenda;
  $('#fa-obs').value      = a.observacoes||'';
  openModalAgendamento('Editar Agendamento');
}

async function saveAgendamento() {
  const data = {
    paciente_id: parseInt($('#fa-paciente').value),
    medico_id:   parseInt($('#fa-medico').value),
    data: $('#fa-data').value,
    hora: $('#fa-hora').value||'08:00',
    duracao_min: parseInt($('#fa-duracao').value)||30,
    tipo:        $('#fa-tipo').value,
    valor:       parseFloat($('#fa-valor').value)||0,
    status_pgto: $('#fa-pgto').value,
    status_agenda:$('#fa-status').value,
    observacoes: $('#fa-obs').value.trim()
  };
  if(!data.paciente_id||!data.medico_id||!$('#fa-data').value) { toast('Paciente, médico e data são obrigatórios','error'); return; }
  const btn=$('#btn-save-ag'); btn.disabled=true; btn.innerHTML='<div class="spinner"></div>';

  // Verificar se era realizado antes (para não duplicar lançamento)
  const eraRealizado = state.editingId ? (state._agendamentoStatusAnterior === 'realizado') : false;
  const ficouRealizado = data.status_agenda === 'realizado';

  const res = state.editingId ? await API.put('/api/agendamentos/'+state.editingId,data) : await API.post('/api/agendamentos',data);
  btn.disabled=false; btn.textContent='Salvar';
  if(!res.ok) { toast(res.error||'Erro ao salvar','error'); return; }

  const pac = state.pacientes.find(p=>p.id===data.paciente_id);
  const agId = state.editingId || res.id;

  if(ficouRealizado && !eraRealizado) {
    // Novo lançamento — consulta marcada como realizada pela primeira vez
    await API.post('/api/financeiro', {
      tipo: 'receita',
      categoria: pac?.convenio || 'Particular',
      descricao: `Consulta — ${pac?.nome || 'Paciente'} (${data.tipo})`,
      valor: data.valor,
      data: data.data,
      medico_id: data.medico_id,
      agendamento_id: agId,
      status: data.status_pgto === 'pago' ? 'confirmado' : 'pendente',
      forma_pgto: data.status_pgto === 'pago' ? 'dinheiro' : 'pendente',
      observacoes: ''
    });
    toast('Consulta realizada! Lançamento criado no financeiro.');
  } else if(ficouRealizado && eraRealizado && state.editingId) {
    // Já era realizado — buscar lançamento vinculado e atualizar valor/status
    const lancRes = await API.get('/api/financeiro?data_ini=2020-01-01&data_fim=2099-12-31');
    if(lancRes.ok) {
      const lanc = lancRes.lancamentos?.find(l=>l.agendamento_id===state.editingId);
      if(lanc) {
        await API.put('/api/financeiro/'+lanc.id, {
          tipo: lanc.tipo,
          categoria: lanc.categoria,
          descricao: lanc.descricao,
          valor: data.valor,
          data: lanc.data,
          medico_id: lanc.medico_id,
          status: data.status_pgto === 'pago' ? 'confirmado' : 'pendente',
          forma_pgto: data.status_pgto === 'pago' ? 'dinheiro' : 'pendente',
          observacoes: lanc.observacoes||''
        });
        toast('Agendamento e lançamento financeiro atualizados!');
      } else {
        // Não tinha lançamento ainda — cria um novo
        await API.post('/api/financeiro', {
          tipo: 'receita',
          categoria: pac?.convenio || 'Particular',
          descricao: `Consulta — ${pac?.nome || 'Paciente'} (${data.tipo})`,
          valor: data.valor,
          data: data.data,
          medico_id: data.medico_id,
          agendamento_id: agId,
          status: data.status_pgto === 'pago' ? 'confirmado' : 'pendente',
          forma_pgto: data.status_pgto === 'pago' ? 'dinheiro' : 'pendente',
          observacoes: ''
        });
        toast('Lançamento financeiro criado!');
      }
    }
  } else {
    toast(state.editingId?'Agendamento atualizado!':'Agendamento criado!');
  }

  state._agendamentoStatusAnterior = null;
  closeModalAgendamento(); loadAgenda();
}

async function confirmDeleteAgendamento(id) {
  if(!confirm('Excluir este agendamento?')) return;
  const res = await API.del('/api/agendamentos/'+id);
  if(!res.ok) { toast('Erro ao excluir','error'); return; }
  toast('Agendamento excluído'); loadAgenda();
}

function agendaNavDate(days) {
  const d = new Date(state.agendaDate+'T00:00:00');
  d.setDate(d.getDate()+days);
  state.agendaDate = d.toISOString().slice(0,10);
  loadAgenda();
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $$('.nav-item[data-page]').forEach(btn => btn.addEventListener('click', ()=>navTo(btn.dataset.page)));

  $('#btn-add').addEventListener('click', () => {
    // Check sec-prontuario first (it has no nav-item)
    if(document.getElementById('sec-prontuario')?.classList.contains('active')) { newProntuario(); return; }
    const active = $$('.nav-item.active')[0]?.dataset.page;
    if(active==='pacientes')  newPaciente();
    if(active==='medicos')    newMedico();
    if(active==='agenda')     newAgendamento();
    if(active==='financeiro') newLancamento();
    if(active==='usuarios')   newUsuario();
  });

  let searchTimer;
  $('#search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer=setTimeout(loadPacientes,350); });

  const fs = document.getElementById('filter-status');
  if(fs) fs.addEventListener('change', loadPacientes);

  // Modal paciente
  $('#btn-save').addEventListener('click', savePaciente);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-overlay')) closeModal(); });

  // Modal médico
  $('#btn-save-med').addEventListener('click', saveMedico);
  $('#btn-cancel-med').addEventListener('click', closeModalMedico);
  $('#modal-med-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-med-overlay')) closeModalMedico(); });

  // Modal agendamento
  $('#btn-save-ag').addEventListener('click', saveAgendamento);
  $('#btn-cancel-ag').addEventListener('click', closeModalAgendamento);
  $('#modal-ag-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-ag-overlay')) closeModalAgendamento(); });

  // Agenda nav
  document.getElementById('fin-data-ini')?.addEventListener('change', function(){ finState.data_ini=this.value; loadFinanceiro(); });
  document.getElementById('fin-data-fim')?.addEventListener('change', function(){ finState.data_fim=this.value; loadFinanceiro(); });
  document.getElementById('fin-medico-sel')?.addEventListener('change', function(){ finState.medico_id=this.value; loadFinanceiro(); });
  document.getElementById('btn-sync')?.addEventListener('click', syncAgendamentos);
  document.getElementById('btn-save-prnt')?.addEventListener('click', saveProntuario);
  document.getElementById('btn-cancel-prnt')?.addEventListener('click', closeModalProntuario);
  document.getElementById('modal-prnt-overlay')?.addEventListener('click', e=>{ if(e.target===document.getElementById('modal-prnt-overlay')) closeModalProntuario(); });
  document.getElementById('btn-save-usr')?.addEventListener('click', saveUsuario);
  document.getElementById('btn-cancel-usr')?.addEventListener('click', closeModalUsuario);
  document.getElementById('modal-usr-overlay')?.addEventListener('click', e=>{ if(e.target===document.getElementById('modal-usr-overlay')) closeModalUsuario(); });
  document.getElementById('btn-save-lanc')?.addEventListener('click', saveLancamento);
  document.getElementById('btn-cancel-lanc')?.addEventListener('click', closeModalLanc);
  document.getElementById('modal-lanc-overlay')?.addEventListener('click', e=>{ if(e.target===document.getElementById('modal-lanc-overlay')) closeModalLanc(); });
  document.getElementById('btn-agenda-prev')?.addEventListener('click', ()=>agendaNavDate(-1));
  document.getElementById('btn-agenda-next')?.addEventListener('click', ()=>agendaNavDate(+1));
  document.getElementById('btn-agenda-hoje')?.addEventListener('click', ()=>{ state.agendaDate=new Date().toISOString().slice(0,10); loadAgenda(); });
  document.getElementById('agenda-date-input')?.addEventListener('change', function(){ state.agendaDate=this.value; loadAgenda(); });

  // Máscaras
  $('#f-cpf').addEventListener('input', function(){ this.value=maskCPF(this.value); });
  $('#f-telefone').addEventListener('input', function(){ this.value=maskPhone(this.value); });
  $('#f-cep').addEventListener('input', function(){ this.value=maskCEP(this.value); if(this.value.replace(/\D/g,'').length===8) lookupCEP(this.value); });

  // Role switch
  $('#role-select').addEventListener('change', function(){
    state.role=this.value;
    $('#nav-financeiro').style.display=this.value==='medico'?'none':'';
  });

  // Verificar autenticação
  if (auth.token && auth.usuario) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    iniciarApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }

  // Login form
  document.getElementById('btn-login')?.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    login(email, senha);
  });
  document.getElementById('login-senha')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
  document.getElementById('btn-logout')?.addEventListener('click', logout);

  // Init financeiro dates
  const today = new Date().toISOString().slice(0,10);
  const firstDay = today.slice(0,7) + '-01';
  const elIni = document.getElementById('fin-data-ini');
  const elFim = document.getElementById('fin-data-fim');
  if(elIni) elIni.value = firstDay;
  if(elFim) elFim.value = today;
  finState.data_ini = firstDay;
  finState.data_fim = today;
});


// ══════════════════════════════════════════════
// FINANCEIRO
// ══════════════════════════════════════════════
const finState = {
  data_ini: new Date().toISOString().slice(0,7) + '-01',
  data_fim: new Date().toISOString().slice(0,10),
  medico_id: '',
  dados: null
};

async function loadFinanceiro() {
  const params = new URLSearchParams({
    data_ini: finState.data_ini,
    data_fim: finState.data_fim,
  });
  if (finState.medico_id) params.set('medico_id', finState.medico_id);

  const res = await API.get('/api/financeiro?' + params);
  if (!res.ok) { toast('Erro ao carregar financeiro', 'error'); return; }
  finState.dados = res;
  renderFinanceiro();
  popularFinMedicos();
}

function renderFinanceiro() {
  const d = finState.dados;
  if (!d) return;
  const r = d.resumo;

  // Métricas
  document.getElementById('fin-receita').textContent   = fmt_brl(r.total_receita || 0);
  document.getElementById('fin-despesa').textContent   = fmt_brl(r.total_despesa || 0);
  document.getElementById('fin-resultado').textContent = fmt_brl((r.total_receita||0) - (r.total_despesa||0));
  document.getElementById('fin-pendente').textContent  = fmt_brl(r.receita_pendente || 0);

  // Tabela por médico
  const tbMed = document.getElementById('fin-med-tbody');
  if (tbMed) {
    const maxVal = Math.max(...(d.porMedico||[]).map(m=>m.total), 1);
    tbMed.innerHTML = (d.porMedico||[]).map(m => `
      <tr>
        <td><div class="flex-row">
          <div class="av" style="background:${m.cor||'#E6F1FB'}22;color:${m.cor||'#185FA5'};font-size:10px">${initials(m.nome)}</div>
          <div><div style="font-weight:500;font-size:12px">${m.nome}</div><div style="font-size:10px;color:var(--sub)">${m.especialidade}</div></div>
        </div></td>
        <td>${m.qtd}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:var(--color-background-secondary,#f0f0f0);border-radius:3px">
              <div style="height:6px;border-radius:3px;background:${m.cor||'#185FA5'};width:${Math.round((m.total/maxVal)*100)}%"></div>
            </div>
            <span style="font-size:12px;font-weight:500;min-width:80px;text-align:right">${fmt_brl(m.total)}</span>
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="3" class="tbl-empty">Nenhum dado</td></tr>';
  }

  // Tabela por convênio
  const tbConv = document.getElementById('fin-conv-tbody');
  if (tbConv) {
    tbConv.innerHTML = (d.porConvenio||[]).map(c => `
      <tr>
        <td><span class="badge badge-blue">${c.categoria}</span></td>
        <td>${c.qtd}</td>
        <td style="font-weight:500">${fmt_brl(c.total)}</td>
      </tr>`).join('') || '<tr><td colspan="3" class="tbl-empty">Nenhum dado</td></tr>';
  }

  // Tabela lançamentos
  const tbLanc = document.getElementById('fin-lanc-tbody');
  if (tbLanc) {
    tbLanc.innerHTML = (d.lancamentos||[]).map(l => `
      <tr>
        <td>${fmt_date(l.data)}</td>
        <td><span class="badge ${l.tipo==='receita'?'badge-teal':'badge-coral'}">${l.tipo}</span></td>
        <td>${l.descricao}</td>
        <td>${l.medico_nome||'—'}</td>
        <td><span class="badge badge-blue">${l.categoria}</span></td>
        <td><span class="badge ${l.status==='confirmado'?'badge-teal':l.status==='pendente'?'badge-amber':'badge-red'}">${l.status}</span></td>
        <td style="font-weight:500;color:${l.tipo==='receita'?'var(--teal-mid)':'var(--coral-mid)'}">${l.tipo==='receita'?'+':'-'} ${fmt_brl(l.valor)}</td>
        <td><div class="flex-row">
          <button class="btn btn-sm" onclick="editLancamento(${l.id})">✎</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteLancamento(${l.id})">🗑</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="8" class="tbl-empty">Nenhum lançamento no período</td></tr>';
  }
}

// Modal lançamento
function newLancamento() {
  state.editingId = null; state.editingType = 'lancamento';
  document.getElementById('fl-form').reset();
  document.getElementById('fl-data').value = new Date().toISOString().slice(0,10);
  // popular médicos
  document.getElementById('fl-medico').innerHTML =
    '<option value="">Geral (sem médico)</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  openModalLanc('Novo Lançamento');
}

function openModalLanc(title) {
  document.getElementById('modal-lanc-title').textContent = title;
  document.getElementById('modal-lanc-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModalLanc() {
  document.getElementById('modal-lanc-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.editingId = null;
}

async function editLancamento(id) {
  const res = await API.get('/api/financeiro/' + id);
  if (!res.ok) { toast('Erro', 'error'); return; }
  const l = res.data; state.editingId = id; state.editingType = 'lancamento';
  document.getElementById('fl-tipo').value        = l.tipo;
  document.getElementById('fl-categoria').value   = l.categoria;
  document.getElementById('fl-descricao').value   = l.descricao;
  document.getElementById('fl-valor').value       = l.valor;
  document.getElementById('fl-data').value        = l.data;
  document.getElementById('fl-status').value      = l.status;
  document.getElementById('fl-forma').value       = l.forma_pgto||'dinheiro';
  document.getElementById('fl-obs').value         = l.observacoes||'';
  document.getElementById('fl-medico').innerHTML  =
    '<option value="">Geral (sem médico)</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('fl-medico').value = l.medico_id||'';
  openModalLanc('Editar Lançamento');
}

async function saveLancamento() {
  const data = {
    tipo:       document.getElementById('fl-tipo').value,
    categoria:  document.getElementById('fl-categoria').value.trim(),
    descricao:  document.getElementById('fl-descricao').value.trim(),
    valor:      parseFloat(document.getElementById('fl-valor').value)||0,
    data:       document.getElementById('fl-data').value,
    medico_id:  document.getElementById('fl-medico').value||null,
    status:     document.getElementById('fl-status').value,
    forma_pgto: document.getElementById('fl-forma').value,
    observacoes:document.getElementById('fl-obs').value.trim()
  };
  if (!data.descricao || !data.valor || !data.data) { toast('Preencha os campos obrigatórios', 'error'); return; }
  const btn = document.getElementById('btn-save-lanc'); btn.disabled=true; btn.innerHTML='<div class="spinner"></div>';
  const res = state.editingId ? await API.put('/api/financeiro/'+state.editingId, data) : await API.post('/api/financeiro', data);
  btn.disabled=false; btn.textContent='Salvar';
  if (!res.ok) { toast(res.error||'Erro', 'error'); return; }
  toast(state.editingId ? 'Lançamento atualizado!' : 'Lançamento criado!');
  closeModalLanc(); loadFinanceiro();
}

async function confirmDeleteLancamento(id) {
  if (!confirm('Excluir este lançamento?')) return;
  const res = await API.del('/api/financeiro/' + id);
  if (!res.ok) { toast('Erro', 'error'); return; }
  toast('Lançamento excluído'); loadFinanceiro();
}

async function syncAgendamentos() {
  const btn = document.getElementById('btn-sync');
  btn.disabled = true; btn.textContent = 'Importando...';
  const res = await API.post('/api/financeiro/sync', {
    data_ini: finState.data_ini,
    data_fim: finState.data_fim
  });
  btn.disabled = false; btn.textContent = '⟳ Importar realizados';
  if (!res.ok) { toast(res.error||'Erro', 'error'); return; }
  toast(`${res.importados} agendamento(s) importado(s)!`);
  loadFinanceiro();
}

// Popular select médicos no financeiro quando carregar
function popularFinMedicos() {
  const sel = document.getElementById('fin-medico-sel');
  if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="">Todos os médicos</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  sel.value = val;
}

// ══════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════
async function loadUsuarios() {
  const res = await API.get('/api/usuarios');
  if (!res.ok) { toast('Erro ao carregar usuários', 'error'); return; }
  renderUsuarios(res.data);
}

function renderUsuarios(lista) {
  const tbody = document.getElementById('usr-tbody');
  if (!tbody) return;
  if (!lista.length) { tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">Nenhum usuário</td></tr>'; return; }
  const perfilBadge = { admin:'badge-blue', medico:'badge-teal', secretaria:'badge-amber' };
  tbody.innerHTML = lista.map(u => {
    const med = state.medicos.find(m => m.id === u.medico_id);
    return `<tr>
      <td style="font-weight:500">${u.nome}</td>
      <td style="color:var(--sub)">${u.email}</td>
      <td><span class="badge ${perfilBadge[u.perfil]||'badge-blue'}">${u.perfil}</span></td>
      <td>${med ? med.nome : '—'}</td>
      <td><span class="badge ${u.ativo?'badge-teal':'badge-red'}">${u.ativo?'Ativo':'Inativo'}</span></td>
      <td><div class="flex-row">
        <button class="btn btn-sm" onclick="editUsuario(${u.id})">✎ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteUsuario(${u.id},'${u.nome.replace(/'/g,"\\'")}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function newUsuario() {
  state.editingId = null; state.editingType = 'usuario';
  document.getElementById('fu-form').reset();
  document.getElementById('fu-medico').innerHTML =
    '<option value="">Nenhum (não é médico)</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('fu-senha-label').textContent = 'Senha *';
  openModalUsuario('Novo Usuário');
}

function openModalUsuario(title) {
  document.getElementById('modal-usr-title').textContent = title;
  document.getElementById('modal-usr-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModalUsuario() {
  document.getElementById('modal-usr-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.editingId = null;
}

async function editUsuario(id) {
  const res = await API.get('/api/usuarios');
  if (!res.ok) return;
  const u = res.data.find(x => x.id === id);
  if (!u) return;
  state.editingId = id;
  document.getElementById('fu-nome').value = u.nome;
  document.getElementById('fu-email').value = u.email;
  document.getElementById('fu-perfil').value = u.perfil;
  document.getElementById('fu-ativo').value = u.ativo ? '1' : '0';
  document.getElementById('fu-senha').value = '';
  document.getElementById('fu-senha-label').textContent = 'Nova senha (deixe vazio para manter)';
  document.getElementById('fu-medico').innerHTML =
    '<option value="">Nenhum (não é médico)</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('fu-medico').value = u.medico_id || '';
  openModalUsuario('Editar Usuário — ' + u.nome);
}

async function saveUsuario() {
  const data = {
    nome:     document.getElementById('fu-nome').value.trim(),
    email:    document.getElementById('fu-email').value.trim(),
    senha:    document.getElementById('fu-senha').value,
    perfil:   document.getElementById('fu-perfil').value,
    medico_id:document.getElementById('fu-medico').value || null,
    ativo:    parseInt(document.getElementById('fu-ativo').value)
  };
  if (!data.nome || !data.email || !data.perfil) { toast('Preencha os campos obrigatórios', 'error'); return; }
  if (!state.editingId && !data.senha) { toast('Senha é obrigatória para novo usuário', 'error'); return; }

  const btn = document.getElementById('btn-save-usr');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  const res = state.editingId
    ? await API.put('/api/usuarios/' + state.editingId, data)
    : await API.post('/api/usuarios', data);
  btn.disabled = false; btn.textContent = 'Salvar';
  if (!res.ok) { toast(res.error || 'Erro', 'error'); return; }
  toast(state.editingId ? 'Usuário atualizado!' : 'Usuário criado!');
  closeModalUsuario(); loadUsuarios();
}

async function confirmDeleteUsuario(id, nome) {
  if (!confirm(`Excluir usuário "${nome}"?`)) return;
  const res = await API.del('/api/usuarios/' + id);
  if (!res.ok) { toast('Erro ao excluir', 'error'); return; }
  toast('Usuário excluído'); loadUsuarios();
}

// ══════════════════════════════════════════════
// PRONTUÁRIO
// ══════════════════════════════════════════════
const prontState = { pacienteAtual: null, prontuarios: [] };

async function abrirProntuario(pacienteId) {
  const pac = state.pacientes.find(p => p.id == pacienteId);
  if (!pac) return;
  prontState.pacienteAtual = pac;

  // Atualizar header do prontuário
  document.getElementById('prnt-pac-nome').textContent = pac.nome;
  document.getElementById('prnt-pac-info').textContent =
    `${pac.cpf} · ${fmt_date(pac.nascimento)} · ${pac.convenio}`;

  // Mostrar seção prontuário
  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-prontuario').classList.add('active');
  document.getElementById('topbar-title').textContent = 'Prontuário';
  document.getElementById('btn-add').textContent = '+ Nova Consulta';
  document.getElementById('btn-add').style.display = '';
  document.getElementById('search-input').style.display = 'none';

  await loadProntuarios(pacienteId);
}

async function loadProntuarios(pacienteId) {
  const res = await API.get('/api/prontuarios?paciente_id=' + pacienteId);
  if (!res.ok) { toast('Erro ao carregar prontuário', 'error'); return; }
  prontState.prontuarios = res.data;
  renderProntuarios();
}

function renderProntuarios() {
  const container = document.getElementById('prnt-lista');
  if (!prontState.prontuarios.length) {
    container.innerHTML = '<div class="tbl-empty" style="padding:32px;text-align:center">Nenhuma consulta registrada</div>';
    return;
  }
  container.innerHTML = prontState.prontuarios.map(p => `
    <div class="prnt-card" onclick="verProntuario(${p.id})">
      <div class="prnt-card-header">
        <div class="flex-row">
          <div class="av" style="background:${p.medico_cor||'#E6F1FB'}22;color:${p.medico_cor||'#185FA5'};font-size:10px">${initials(p.medico_nome)}</div>
          <div>
            <div style="font-weight:500;font-size:13px">${fmt_date(p.data_consulta)}</div>
            <div style="font-size:11px;color:var(--sub)">${p.medico_nome} · ${p.especialidade}</div>
          </div>
        </div>
        <div class="flex-row">
          <button class="btn btn-sm" onclick="event.stopPropagation();editProntuario(${p.id})">✎ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDeleteProntuario(${p.id})">🗑</button>
        </div>
      </div>
      ${p.hipotese_diagnostica ? `<div class="prnt-diag"><span class="badge badge-blue">CID: ${p.cid||'—'}</span> ${p.hipotese_diagnostica}</div>` : ''}
      ${p.queixa_principal ? `<div class="prnt-queixa">${p.queixa_principal}</div>` : ''}
      ${p.prescricao ? `<div class="prnt-prescricao"><strong>Prescrição:</strong> ${p.prescricao.slice(0,120)}${p.prescricao.length>120?'...':''}</div>` : ''}
      ${p.retorno_dias ? `<div style="font-size:11px;color:var(--teal);margin-top:6px">Retorno em ${p.retorno_dias} dias</div>` : ''}
    </div>
  `).join('');
}

function verProntuario(id) {
  const p = prontState.prontuarios.find(x => x.id === id);
  if (!p) return;
  editProntuario(id);
}

function newProntuario() {
  state.editingId = null; state.editingType = 'prontuario';
  document.getElementById('fp-form').reset();
  document.getElementById('fp-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('fp-paciente').value = prontState.pacienteAtual?.id || '';
  document.getElementById('fp-medico').innerHTML =
    '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  openModalProntuario('Nova Consulta — ' + (prontState.pacienteAtual?.nome || ''));
}

function openModalProntuario(title) {
  document.getElementById('modal-prnt-title').textContent = title;
  document.getElementById('modal-prnt-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModalProntuario() {
  document.getElementById('modal-prnt-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.editingId = null;
}

async function editProntuario(id) {
  const res = await API.get('/api/prontuarios/' + id);
  if (!res.ok) { toast('Erro', 'error'); return; }
  const p = res.data; state.editingId = id; state.editingType = 'prontuario';

  document.getElementById('fp-data').value              = p.data_consulta || '';
  document.getElementById('fp-paciente').value          = p.paciente_id || '';
  document.getElementById('fp-medico').innerHTML =
    '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  document.getElementById('fp-medico').value            = p.medico_id || '';
  document.getElementById('fp-queixa').value            = p.queixa_principal || '';
  document.getElementById('fp-historia').value          = p.historia_doenca || '';
  document.getElementById('fp-antecedentes').value      = p.antecedentes || '';
  document.getElementById('fp-medicamentos').value      = p.medicamentos_uso || '';
  document.getElementById('fp-alergias').value          = p.alergias || '';
  document.getElementById('fp-peso').value              = p.peso || '';
  document.getElementById('fp-altura').value            = p.altura || '';
  document.getElementById('fp-pa').value                = p.pressao_arterial || '';
  document.getElementById('fp-fc').value                = p.frequencia_cardiaca || '';
  document.getElementById('fp-temp').value              = p.temperatura || '';
  document.getElementById('fp-sat').value               = p.saturacao || '';
  document.getElementById('fp-exame').value             = p.exame_fisico || '';
  document.getElementById('fp-hipotese').value          = p.hipotese_diagnostica || '';
  document.getElementById('fp-cid').value               = p.cid || '';
  document.getElementById('fp-conduta').value           = p.conduta || '';
  document.getElementById('fp-prescricao').value        = p.prescricao || '';
  document.getElementById('fp-retorno').value           = p.retorno_dias || '';
  document.getElementById('fp-obs').value               = p.observacoes || '';

  openModalProntuario('Editar Consulta — ' + p.paciente_nome);
}

async function saveProntuario() {
  const data = {
    paciente_id:          parseInt(document.getElementById('fp-paciente').value),
    medico_id:            parseInt(document.getElementById('fp-medico').value),
    data_consulta:        document.getElementById('fp-data').value,
    queixa_principal:     document.getElementById('fp-queixa').value.trim(),
    historia_doenca:      document.getElementById('fp-historia').value.trim(),
    antecedentes:         document.getElementById('fp-antecedentes').value.trim(),
    medicamentos_uso:     document.getElementById('fp-medicamentos').value.trim(),
    alergias:             document.getElementById('fp-alergias').value.trim(),
    peso:                 parseFloat(document.getElementById('fp-peso').value) || null,
    altura:               parseFloat(document.getElementById('fp-altura').value) || null,
    pressao_arterial:     document.getElementById('fp-pa').value.trim(),
    frequencia_cardiaca:  parseInt(document.getElementById('fp-fc').value) || null,
    temperatura:          parseFloat(document.getElementById('fp-temp').value) || null,
    saturacao:            parseInt(document.getElementById('fp-sat').value) || null,
    exame_fisico:         document.getElementById('fp-exame').value.trim(),
    hipotese_diagnostica: document.getElementById('fp-hipotese').value.trim(),
    cid:                  document.getElementById('fp-cid').value.trim(),
    conduta:              document.getElementById('fp-conduta').value.trim(),
    prescricao:           document.getElementById('fp-prescricao').value.trim(),
    retorno_dias:         parseInt(document.getElementById('fp-retorno').value) || null,
    observacoes:          document.getElementById('fp-obs').value.trim()
  };

  if (!data.paciente_id || !data.medico_id || !data.data_consulta) {
    toast('Paciente, médico e data são obrigatórios', 'error'); return;
  }

  const btn = document.getElementById('btn-save-prnt');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  const res = state.editingId
    ? await API.put('/api/prontuarios/' + state.editingId, data)
    : await API.post('/api/prontuarios', data);
  btn.disabled = false; btn.textContent = 'Salvar';

  if (!res.ok) { toast(res.error || 'Erro', 'error'); return; }
  toast(state.editingId ? 'Consulta atualizada!' : 'Consulta registrada!');
  closeModalProntuario();
  if (prontState.pacienteAtual) loadProntuarios(prontState.pacienteAtual.id);
}

async function confirmDeleteProntuario(id) {
  if (!confirm('Excluir este registro de consulta?')) return;
  const res = await API.del('/api/prontuarios/' + id);
  if (!res.ok) { toast('Erro ao excluir', 'error'); return; }
  toast('Consulta excluída');
  if (prontState.pacienteAtual) loadProntuarios(prontState.pacienteAtual.id);
}

// Abrir prontuário pela agenda
function abrirProntuarioAgendamento(agendamentoId) {
  const ag = state.agendamentos.find(a => a.id === agendamentoId);
  if (!ag) return;
  const pac = state.pacientes.find(p => p.id === ag.paciente_id);
  if (pac) abrirProntuario(pac.id);
}
