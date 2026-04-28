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
  // Limpar cache do perfil anterior
  state.pacientes = []; state.medicos = []; state.agendamentos = [];
  state.editingId = null; state.editingType = null;
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
  const roleArea = document.querySelector('.role-area');
  if(roleArea) roleArea.style.display = p === 'admin' ? '' : 'none';
  const backupBtns = document.getElementById('backup-buttons');
  if(backupBtns) backupBtns.style.display = p === 'admin' ? 'flex' : 'none';
  const finNav = document.getElementById('nav-financeiro');
  const medNav = document.getElementById('nav-medicos');
  const usrNav = document.getElementById('nav-usuarios');
  if (p === 'medico') {
    if (finNav) finNav.style.display = '';
    if (medNav) medNav.style.display = 'none';
    if (usrNav) usrNav.style.display = 'none';
  } else if (p === 'secretaria') {
    if (finNav) finNav.style.display = '';
    if (medNav) medNav.style.display = 'none';
    if (usrNav) usrNav.style.display = 'none';
  }
}


// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════
async function loadDashboard() {
  const params = new URLSearchParams();
  if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id) {
    params.set('medico_id', auth.usuario.medico_id);
  }

  const res = await API.get('/api/dashboard?' + params);
  if (!res.ok) return;

  const mTotal = document.getElementById('dash-total-pac');
  const mHoje  = document.getElementById('dash-consultas-hoje');
  const mRec   = document.getElementById('dash-receita-mes');
  const mPend  = document.getElementById('dash-pendencias');

  if (mTotal) mTotal.textContent = res.totalPacientes;
  if (mHoje)  mHoje.textContent  = res.consultasHoje;
  if (mRec)   mRec.textContent   = fmt_brl(res.receitaMes);
  if (mPend)  mPend.textContent  = res.pendencias;

  const agTbody = document.getElementById('dash-agenda-tbody');
  if (agTbody) {
    if (!res.agendaHoje.length) {
      agTbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Nenhuma consulta hoje</td></tr>';
    } else {
      agTbody.innerHTML = res.agendaHoje.map(a => `
        <tr>
          <td style="font-weight:500">${a.hora}</td>
          <td>${a.paciente_nome}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div style="width:8px;height:8px;border-radius:50%;background:${a.medico_cor||'#185FA5'}"></div>
            ${a.medico_nome}
          </div></td>
          <td>${a.tipo}</td>
          <td><span class="badge ${a.status_agenda==='realizado'?'badge-teal':a.status_agenda==='confirmado'?'badge-blue':'badge-amber'}">${a.status_agenda}</span></td>
        </tr>`).join('');
    }
  }

  const anivEl = document.getElementById('dash-aniversariantes');
  if (anivEl) {
    if (!res.aniversariantes.length) {
      anivEl.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:8px">Nenhum aniversariante este mês</div>';
    } else {
      anivEl.innerHTML = res.aniversariantes.map(p => {
        const dia = p.nascimento ? p.nascimento.slice(8,10) : '—';
        const mes = p.nascimento ? new Date(p.nascimento+'T00:00:00').toLocaleDateString('pt-BR',{month:'short'}) : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--border)">
          <div style="width:32px;height:32px;border-radius:50%;background:#FEF3CD;display:flex;align-items:center;justify-content:center;font-size:14px">🎂</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:500">${p.nome}</div>
            <div style="font-size:11px;color:var(--sub)">${dia}/${mes}</div>
          </div>
          ${p.telefone ? `<button class="btn btn-sm" onclick="abrirWhatsApp('${p.telefone}','Olá ${p.nome}! A clínica deseja um feliz aniversário! 🎂')" style="padding:3px 8px;font-size:10px;background:#25D366;color:#fff;border-color:#25D366">📱</button>` : ''}
        </div>`;
      }).join('');
    }
  }

  // Storage usage
  const storageEl = document.getElementById('dash-storage');
  if (storageEl) {
    try {
      const arqAll = await fetch('/api/arquivos?todos=1', { headers: apiHeaders() });
      const arqData = await arqAll.json();
      if (arqData.ok) {
        const totalBytes = arqData.data.reduce((s, a) => s + (a.tamanho || 0), 0);
        const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
        const totalGB = (totalBytes / 1024 / 1024 / 1024).toFixed(2);
        const limitGB = 10;
        const pct = Math.min(((totalBytes / 1024 / 1024 / 1024) / limitGB) * 100, 100).toFixed(1);
        const cor = pct < 50 ? '#0F6E56' : pct < 80 ? '#854F0B' : '#A32D2D';
        storageEl.innerHTML = `
          <div style="font-size:11px;color:var(--sub);margin-bottom:6px">Arquivos no R2</div>
          <div style="font-size:18px;font-weight:600;color:${cor}">${totalMB} MB <span style="font-size:12px;color:var(--sub)">/ 10 GB</span></div>
          <div style="margin-top:8px;height:6px;background:#eee;border-radius:3px">
            <div style="height:6px;border-radius:3px;background:${cor};width:${pct}%"></div>
          </div>
          <div style="font-size:11px;color:var(--sub);margin-top:4px">${pct}% utilizado · ${arqData.data.length} arquivo(s)</div>
        `;
      }
    } catch(e) {}
  }

  const ultEl = document.getElementById('dash-ultimos-pac');
  if (ultEl) {
    if (!res.ultimosPacientes.length) {
      ultEl.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:8px">Nenhum paciente cadastrado</div>';
    } else {
      ultEl.innerHTML = res.ultimosPacientes.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--border)">
          <div class="av" style="font-size:10px">${initials(p.nome)}</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:500">${p.nome}</div>
            <div style="font-size:11px;color:var(--sub)">${p.convenio||'Particular'}</div>
          </div>
        </div>`).join('');
    }
  }
}

// ══════════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════════
async function verificarBackup() {
  try {
    const res = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();
    if (!data.ok) return;
    const agora = new Date();
    const hora = agora.getHours();
    const backupHoje = data.backup_hoje;
    if (hora >= 16 && !backupHoje) {
      mostrarAvisoBackup(data.ultimo_backup);
    }
  } catch(e) {}
}

function mostrarAvisoBackup(ultimoBackup) {
  const fechado = localStorage.getItem('backup_aviso_fechado');
  const hoje = new Date().toISOString().slice(0,10);
  if (fechado === hoje) return;
  const aviso = document.createElement('div');
  aviso.id = 'backup-aviso';
  aviso.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#fff;border:1.5px solid #856404;border-radius:12px;padding:16px 20px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:1000;max-width:320px;';
  aviso.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:20px">💾</span>
      <div>
        <div style="font-weight:600;font-size:13px;color:#856404">Lembrete de Backup</div>
        <div style="font-size:11px;color:#666">Último backup: ${ultimoBackup ? new Date(ultimoBackup+'T00:00:00').toLocaleDateString('pt-BR') : 'Nunca realizado'}</div>
      </div>
    </div>
    <div style="font-size:12px;color:#555;margin-bottom:12px">Faça o backup diário dos dados da clínica.</div>
    <div style="display:flex;gap:8px">
      <button onclick="fazerBackup('sql')" style="flex:1;padding:7px;background:#185FA5;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">💾 SQL</button>
      <button onclick="fazerBackup('csv')" style="flex:1;padding:7px;background:#2D7D46;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">📊 CSV</button>
      <button onclick="fecharAvisoBackup()" style="padding:7px 10px;background:#f0f0f0;border:none;border-radius:6px;font-size:12px;cursor:pointer">✕</button>
    </div>
  `;
  document.body.appendChild(aviso);
}

function fecharAvisoBackup() {
  const hoje = new Date().toISOString().slice(0,10);
  localStorage.setItem('backup_aviso_fechado', hoje);
  const aviso = document.getElementById('backup-aviso');
  if (aviso) aviso.remove();
}

function fazerBackup(formato) {
  window.open('/api/backup?formato=' + formato, '_blank');
  fecharAvisoBackup();
  toast('Backup ' + formato.toUpperCase() + ' iniciado!');
}

function iniciarVerificacaoBackup() {
  if (auth.usuario?.perfil !== 'admin') return;
  verificarBackup();
  setInterval(verificarBackup, 30 * 60 * 1000);
}

// ══════════════════════════════════════════════
// REFRESH INTELIGENTE
// ══════════════════════════════════════════════
const refreshState = { timer: null, lastUpdate: null };

function atualizarUltimaAtualizacao() {
  const agora = new Date();
  const hora = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const el = document.getElementById('last-update');
  if (el) el.textContent = 'Atualizado às ' + hora;
  refreshState.lastUpdate = agora;
}

function recarregarPaginaAtual() {
  const active = document.querySelector('.nav-item.active')?.dataset?.page;
  if (!active) return;
  if (active === 'pacientes')  { loadPacientes(); }
  if (active === 'medicos')    { loadMedicos(); }
  if (active === 'agenda')     { loadAgenda(); }
  if (active === 'financeiro') { loadFinanceiro(); }
  if (active === 'usuarios')   { loadUsuarios(); }
  if (document.getElementById('sec-prontuario')?.classList.contains('active') && prontState.pacienteAtual) {
    loadProntuarios(prontState.pacienteAtual.id);
  }
  atualizarUltimaAtualizacao();
}

function iniciarRefreshAutomatico() {
  if (refreshState.timer) clearInterval(refreshState.timer);
  refreshState.timer = setInterval(() => {
    const active = document.querySelector('.nav-item.active')?.dataset?.page;
    if (active === 'agenda') recarregarPaginaAtual();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const diff = refreshState.lastUpdate ? (new Date() - refreshState.lastUpdate) / 1000 : 999;
      if (diff > 30) { recarregarPaginaAtual(); }
    }
  });

  window.addEventListener('focus', () => {
    const diff = refreshState.lastUpdate ? (new Date() - refreshState.lastUpdate) / 1000 : 999;
    if (diff > 30) { recarregarPaginaAtual(); }
  });

  atualizarUltimaAtualizacao();
}

async function iniciarApp() {
  if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id) {
    const res = await API.get('/api/medicos/' + auth.usuario.medico_id);
    if (res.ok) {
      auth.usuario.ver_todos_pacientes = res.data.ver_todos_pacientes || 0;
      localStorage.setItem('clinica_usuario', JSON.stringify(auth.usuario));
    }
  }
  aplicarPermissoes();
  const p = auth.usuario?.perfil;
  navTo(p === 'medico' || p === 'secretaria' ? 'agenda' : 'pacientes');
  loadMedicos();
  iniciarRefreshAutomatico();
  iniciarVerificacaoBackup();
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
  dashboard:  { title:'Dashboard',  addBtn:'',                    showSearch:false },
  usuarios:   { title:'Usuários',   addBtn:'+ Novo Usuário',      showSearch:false }
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
  if (page === 'dashboard')  { loadDashboard(); }
  if (page === 'financeiro'){ loadFinanceiro(); }
  if (page === 'usuarios')  { loadUsuarios(); }
  atualizarUltimaAtualizacao();
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
  if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id && !auth.usuario?.ver_todos_pacientes) {
    params.set('medico_id', auth.usuario.medico_id);
  }
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
        ${auth.usuario?.perfil !== 'secretaria' ? `<button class="btn btn-sm" onclick="abrirProntuario(${p.id})" title="Prontuário" style="background:var(--teal-light);color:var(--teal);border-color:transparent">📋 Prontuário</button>` : ''}
        <button class="btn btn-sm" onclick="editPaciente(${p.id})">✎ Editar</button>
        ${auth.usuario?.perfil !== 'secretaria' ? `<button class="btn btn-sm btn-danger" onclick="confirmDeletePaciente(${p.id},'${p.nome.replace(/'/g,"\\'")}')">🗑</button>` : ''}
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

function openModal(title) { $('#modal-title').textContent=title; $('#modal-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal() { $('#modal-overlay').classList.remove('open'); document.body.style.overflow=''; state.editingId=null; state.editingType=null; resetForm('#pac-form'); }

function resetForm(sel) {
  const form = $(sel);
  if(!form) return;
  form.reset();
  $$('.field-error', form).forEach(e=>e.textContent='');
  $$('.error', form).forEach(e=>e.classList.remove('error'));
}

function newPaciente() {
  state.editingId=null; state.editingType='paciente';
  resetForm('#pac-form');
  // Resetar seção de agendamento
  const chk = document.getElementById('chk-agendar');
  if (chk) { chk.checked = false; toggleAgendarJunto(false); }
  const fa2data = document.getElementById('fa2-data');
  if (fa2data) fa2data.value = new Date().toISOString().slice(0,10);
  // Popular médicos no select do agendamento
  const fa2med = document.getElementById('fa2-medico');
  if (fa2med) {
    fa2med.innerHTML = '<option value="">Selecione...</option>' +
      state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
    // Pré-selecionar médico logado se for médico
    if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id) {
      fa2med.value = auth.usuario.medico_id;
    }
  }
  openModal('Novo Paciente');
  setTimeout(()=>$('#f-nome').focus(),100);
}

function toggleAgendarJunto(checked) {
  const campos = document.getElementById('campos-agendamento');
  if (campos) campos.style.display = checked ? '' : 'none';
}

async function savePacienteEAgendar() {
  // Salvar paciente normalmente primeiro
  const nomePac = $('#f-nome').value.trim();
  if (!nomePac) { toast('Preencha o nome do paciente', 'error'); return; }
  await savePaciente();
  // O agendamento será criado após o paciente ser salvo — via loadPacientes
}

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

  // Verificar se deve criar agendamento junto
  const chkAgendar = document.getElementById('chk-agendar');
  if (!state.editingId && chkAgendar?.checked) {
    const medicoId = parseInt(document.getElementById('fa2-medico')?.value);
    const dataAg   = document.getElementById('fa2-data')?.value;
    const horaAg   = document.getElementById('fa2-hora')?.value || '08:00';
    const tipoAg   = document.getElementById('fa2-tipo')?.value || 'Consulta';

    if (medicoId && dataAg) {
      // Buscar ID do paciente recém criado
      const pacId = res.id;
      const valor = parseFloat($('#f-valor').value) || 0;
      await API.post('/api/agendamentos', {
        paciente_id:   pacId,
        medico_id:     medicoId,
        data:          dataAg,
        hora:          horaAg,
        duracao_min:   30,
        tipo:          tipoAg,
        valor:         valor,
        status_pgto:   'pendente',
        status_agenda: 'agendado',
        observacoes:   ''
      });
      toast('Paciente cadastrado e consulta agendada! ✅');
    } else {
      toast('Paciente cadastrado! (Agendamento não criado — médico ou data não informados)', 'error');
    }
  } else {
    toast(state.editingId ? 'Paciente atualizado!' : 'Paciente cadastrado!');
  }

  closeModal(); loadPacientes();
}

async function confirmDeletePaciente(id, nome) {
  if(!confirm(`Excluir "${nome}"?`)) return;
  const res = await API.del('/api/pacientes/'+id);
  if(!res.ok) {
    if (res.temVinculos) {
      const msg = `⚠️ ${res.error}\n\nDeseja excluir o paciente e TODOS os registros vinculados?\n\nEsta ação não pode ser desfeita!`;
      if (!confirm(msg)) return;
      const res2 = await API.del('/api/pacientes/'+id+'?cascata=1');
      if (!res2.ok) { toast('Erro ao excluir','error'); return; }
      toast('Paciente e todos os registros vinculados foram excluídos!');
      loadPacientes();
      return;
    }
    toast('Erro ao excluir','error'); return;
  }
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
    status:$('#fm-status').value,
    ver_todos_pacientes: parseInt(document.getElementById('fm-ver-todos')?.value||'0')
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

  const res = await API.get('/api/agendamentos?data='+state.agendaDate+'&_='+Date.now());
  if(!res.ok) { toast('Erro ao carregar agenda','error'); return; }
  state.agendamentos = res.data;
  renderAgenda();
}

function renderAgenda() {
  const container = $('#agenda-cols');
  if(!container) return;
  const medAtivos = auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id
    ? state.medicos.filter(m=>m.status==='ativo' && m.id === auth.usuario.medico_id)
    : state.medicos.filter(m=>m.status==='ativo');
  if(!medAtivos.length) { container.innerHTML='<div class="coming-soon"><p>Nenhum médico ativo cadastrado</p></div>'; return; }

  const horas = ['07:00','07:20','07:40','08:00','08:20','08:40','09:00','09:20','09:40',
                 '10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40',
                 '13:00','13:20','13:40','14:00','14:20','14:40','15:00','15:20','15:40',
                 '16:00','16:20','16:40','17:00','17:20','17:40','18:00'];

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
            <button class="btn btn-sm" style="padding:2px 7px;font-size:10px;background:#25D366;color:#fff;border-color:#25D366" onclick="enviarLembreteConsulta(${ag.id})" title="Lembrete WhatsApp">📱</button>
            ${ag.status_agenda !== 'realizado' && ag.status_agenda !== 'cancelado' ? `
            <button class="btn btn-sm" style="padding:2px 7px;font-size:10px;background:#3B6D11;color:#fff;border-color:#3B6D11" onclick="marcarRealizado(${ag.id}, false)" title="Marcar como realizado">✔ Realizado</button>
            <button class="btn btn-sm" style="padding:2px 7px;font-size:10px;background:#0F6E56;color:#fff;border-color:#0F6E56" onclick="marcarRealizado(${ag.id}, true)" title="Marcar como realizado e pago">💰 Pago</button>
            ` : ''}
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
        <button class="btn btn-sm" style="padding:3px 8px;font-size:10px;background:#25D366;color:#fff;border-color:#25D366" onclick="enviarAgendaMedico(${med.id})" title="Enviar agenda por WhatsApp">📱 WA</button>
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
  $('#fa-paciente').innerHTML = '<option value="">Selecione o paciente...</option>' +
    state.pacientes.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  $('#fa-medico').innerHTML = '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  openModalAgendamento('Novo Agendamento');
}

function openModalAgendamento(title) { $('#modal-ag-title').textContent=title; $('#modal-ag-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModalAgendamento() { $('#modal-ag-overlay').classList.remove('open'); document.body.style.overflow=''; state.editingId=null; }

function toggleNovoPacienteRapido() {
  const div = document.getElementById('novo-pac-rapido');
  const visible = div.style.display !== 'none';
  div.style.display = visible ? 'none' : '';
  if (!visible) {
    // Limpar campos
    document.getElementById('rp-nome').value = '';
    document.getElementById('rp-telefone').value = '';
    document.getElementById('rp-cpf').value = '';
    document.getElementById('rp-nascimento').value = '';
    document.getElementById('rp-valor').value = '';
    document.getElementById('rp-convenio').value = 'Particular';
    setTimeout(() => document.getElementById('rp-nome').focus(), 100);
  }
}

async function salvarPacienteRapido() {
  const nome = document.getElementById('rp-nome').value.trim();
  const telefone = document.getElementById('rp-telefone').value.trim();
  if (!nome || !telefone) { toast('Nome e telefone são obrigatórios', 'error'); return; }

  const btn = document.querySelector('#novo-pac-rapido button:last-child');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

  const data = {
    nome,
    telefone,
    cpf:            document.getElementById('rp-cpf').value.trim() || '000.000.000-00',
    nascimento:     document.getElementById('rp-nascimento').value || '2000-01-01',
    sexo:           'O',
    email:          '',
    convenio:       document.getElementById('rp-convenio').value,
    valor_consulta: parseFloat(document.getElementById('rp-valor').value) || 0,
    status:         'ativo',
    observacoes:    ''
  };

  const res = await API.post('/api/pacientes', data);
  btn.disabled = false; btn.textContent = '💾 Salvar paciente';

  if (!res.ok) { toast(res.error || 'Erro ao salvar', 'error'); return; }

  toast(`${nome} cadastrado com sucesso!`);

  // Recarregar lista de pacientes e selecionar o novo
  await loadPacientes();
  const select = document.getElementById('fa-paciente');
  select.innerHTML = '<option value="">Selecione o paciente...</option>' +
    state.pacientes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

  // Selecionar paciente recém criado
  if (res.id) {
    select.value = res.id;
    onPacienteSelect(res.id);
  }

  // Fechar mini formulário
  toggleNovoPacienteRapido();
}

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

  // Verificar conflito de horário
  const conflito = state.agendamentos.find(a =>
    a.medico_id === data.medico_id &&
    a.data === data.data &&
    a.hora === data.hora &&
    a.status_agenda !== 'cancelado' &&
    a.id !== state.editingId
  );
  if (conflito) {
    const pac = state.pacientes.find(p => p.id === conflito.paciente_id);
    const nomePac = pac ? pac.nome : 'outro paciente';
    if (!confirm(`⚠️ Conflito de horário!\n\nJá existe agendamento às ${data.hora} para ${nomePac}.\n\nDeseja criar um encaixe mesmo assim?`)) return;
  }

  const btn=$('#btn-save-ag'); btn.disabled=true; btn.innerHTML='<div class="spinner"></div>';

  const eraRealizado = state.editingId ? (state._agendamentoStatusAnterior === 'realizado') : false;
  const ficouRealizado = data.status_agenda === 'realizado';

  const res = state.editingId ? await API.put('/api/agendamentos/'+state.editingId,data) : await API.post('/api/agendamentos',data);
  btn.disabled=false; btn.textContent='Salvar';
  if(!res.ok) { toast(res.error||'Erro ao salvar','error'); return; }

  const pac = state.pacientes.find(p=>p.id===data.paciente_id);
  const agId = state.editingId || res.id;

  if(ficouRealizado && !eraRealizado) {
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
    const lancRes = await API.get('/api/financeiro?data_ini=2020-01-01&data_fim=2099-12-31');
    if(lancRes.ok) {
      const lanc = lancRes.lancamentos?.find(l=>l.agendamento_id===state.editingId);
      if(lanc) {
        await API.put('/api/financeiro/'+lanc.id, {
          tipo: lanc.tipo, categoria: lanc.categoria, descricao: lanc.descricao,
          valor: data.valor, data: lanc.data, medico_id: lanc.medico_id,
          status: data.status_pgto === 'pago' ? 'confirmado' : 'pendente',
          forma_pgto: data.status_pgto === 'pago' ? 'dinheiro' : 'pendente',
          observacoes: lanc.observacoes||''
        });
        toast('Agendamento e lançamento financeiro atualizados!');
      } else {
        await API.post('/api/financeiro', {
          tipo: 'receita', categoria: pac?.convenio || 'Particular',
          descricao: `Consulta — ${pac?.nome || 'Paciente'} (${data.tipo})`,
          valor: data.valor, data: data.data, medico_id: data.medico_id,
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

  // Sincronizar lançamento financeiro quando status muda
  if (state.editingId) {
    const lancRes = await API.get('/api/financeiro?data_ini=2020-01-01&data_fim=2099-12-31');
    if (lancRes.ok) {
      const lanc = lancRes.lancamentos?.find(l => l.agendamento_id === state.editingId);
      if (lanc) {
        if (data.status_agenda === 'cancelado') {
          // Cancelado → remover lançamento
          await API.del('/api/financeiro/' + lanc.id);
          toast('Agendamento cancelado e lançamento removido.');
        } else if (data.status_agenda !== 'realizado') {
          // Voltou para agendado/confirmado/faltou → lançamento pendente
          await API.put('/api/financeiro/' + lanc.id, {
            ...lanc,
            status:    'pendente',
            forma_pgto:'pendente',
            valor:     data.valor,
            medico_id: lanc.medico_id,
            observacoes: lanc.observacoes || ''
          });
          toast('Status atualizado — lançamento financeiro voltou para Pendente.');
        } else if (data.status_agenda === 'realizado') {
          // Continua realizado — atualizar valor e status pgto
          await API.put('/api/financeiro/' + lanc.id, {
            ...lanc,
            status:    data.status_pgto === 'pago' ? 'confirmado' : 'pendente',
            forma_pgto:data.status_pgto === 'pago' ? 'dinheiro'  : 'pendente',
            valor:     data.valor,
            medico_id: lanc.medico_id,
            observacoes: lanc.observacoes || ''
          });
        }
      }
    }
  }

  state._agendamentoStatusAnterior = null;
  closeModalAgendamento();
  state.agendamentos = [];
  state.pacientes = [];
  await loadAgenda();
}

async function marcarRealizado(id, pago) {
  const ag = state.agendamentos.find(a => a.id === id);
  if (!ag) return;

  const status_pgto = pago ? 'pago' : ag.status_pgto;
  const data = {
    paciente_id:   ag.paciente_id,
    medico_id:     ag.medico_id,
    data:          ag.data,
    hora:          ag.hora,
    duracao_min:   ag.duracao_min,
    tipo:          ag.tipo,
    valor:         ag.valor,
    status_pgto:   status_pgto,
    status_agenda: 'realizado',
    observacoes:   ag.observacoes || ''
  };

  const res = await API.put('/api/agendamentos/' + id, data);
  if (!res.ok) { toast('Erro ao atualizar', 'error'); return; }

  // Atualizar state local imediatamente para o card re-renderizar
  const agIdx = state.agendamentos.findIndex(a => a.id === id);
  if (agIdx >= 0) {
    state.agendamentos[agIdx] = { ...state.agendamentos[agIdx], ...data };
  }
  renderAgenda();

  // Verificar se já existe lançamento para este agendamento
  const lancRes = await API.get('/api/financeiro?data_ini=2020-01-01&data_fim=2099-12-31');
  const pac = state.pacientes.find(p => p.id === ag.paciente_id);

  if (lancRes.ok) {
    const lancExistente = lancRes.lancamentos?.find(l => l.agendamento_id === id);
    if (lancExistente) {
      // Atualizar lançamento existente
      await API.put('/api/financeiro/' + lancExistente.id, {
        tipo:        lancExistente.tipo,
        categoria:   lancExistente.categoria,
        descricao:   lancExistente.descricao,
        valor:       ag.valor,
        data:        lancExistente.data,
        medico_id:   lancExistente.medico_id,
        status:      pago ? 'confirmado' : 'pendente',
        forma_pgto:  pago ? 'dinheiro' : 'pendente',
        observacoes: lancExistente.observacoes || ''
      });
    } else {
      // Criar novo lançamento
      await API.post('/api/financeiro', {
        tipo:          'receita',
        categoria:     pac?.convenio || 'Particular',
        descricao:     `Consulta — ${ag.paciente_nome} (${ag.tipo})`,
        valor:         ag.valor,
        data:          ag.data,
        medico_id:     ag.medico_id,
        agendamento_id: id,
        status:        pago ? 'confirmado' : 'pendente',
        forma_pgto:    pago ? 'dinheiro' : 'pendente',
        observacoes:   ''
      });
    }
  }

  toast(pago ? '💰 Consulta realizada e pagamento confirmado!' : '✔ Consulta marcada como realizada!');
  state.agendamentos = [];
  await loadAgenda();
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
    const sec = auth.usuario?.perfil === 'secretaria';
    if(document.getElementById('sec-prontuario')?.classList.contains('active')) {
      if(!sec) newProntuario();
      return;
    }
    const active = $$('.nav-item.active')[0]?.dataset.page;
    if(active==='pacientes')  newPaciente(); // secretaria pode cadastrar
    if(active==='medicos')    newMedico();
    if(active==='agenda')     newAgendamento();
    if(active==='financeiro') { if(!sec) newLancamento(); }
    if(active==='usuarios')   newUsuario();
  });

  let searchTimer;
  $('#search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer=setTimeout(loadPacientes,350); });

  const fs = document.getElementById('filter-status');
  if(fs) fs.addEventListener('change', loadPacientes);

  $('#btn-save').addEventListener('click', savePaciente);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-overlay')) closeModal(); });

  $('#btn-save-med').addEventListener('click', saveMedico);
  $('#btn-cancel-med').addEventListener('click', closeModalMedico);
  $('#modal-med-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-med-overlay')) closeModalMedico(); });

  $('#btn-save-ag').addEventListener('click', saveAgendamento);
  $('#btn-cancel-ag').addEventListener('click', closeModalAgendamento);
  $('#modal-ag-overlay').addEventListener('click', e=>{ if(e.target===$('#modal-ag-overlay')) closeModalAgendamento(); });

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

  $('#f-cpf').addEventListener('input', function(){ this.value=maskCPF(this.value); });
  $('#f-telefone').addEventListener('input', function(){ this.value=maskPhone(this.value); });
  $('#f-cep').addEventListener('input', function(){ this.value=maskCEP(this.value); if(this.value.replace(/\D/g,'').length===8) lookupCEP(this.value); });

  $('#role-select').addEventListener('change', function(){
    state.role=this.value;
    $('#nav-financeiro').style.display=this.value==='medico'?'none':'';
  });

  if (auth.token && auth.usuario) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    iniciarApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }

  document.getElementById('btn-login')?.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    login(email, senha);
  });
  document.getElementById('login-senha')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-trocar-senha')?.addEventListener('click', abrirTrocarSenha);
  document.getElementById('btn-salvar-senha')?.addEventListener('click', salvarNovaSenha);
  document.getElementById('btn-cancelar-senha')?.addEventListener('click', fecharTrocarSenha);
  document.getElementById('modal-senha-overlay')?.addEventListener('click', e => {
    if(e.target === document.getElementById('modal-senha-overlay')) fecharTrocarSenha();
  });

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
  if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id) {
    params.set('medico_id', auth.usuario.medico_id);
    document.getElementById('fin-medico-sel').style.display = 'none';
  } else if (finState.medico_id) {
    params.set('medico_id', finState.medico_id);
  }

  const res = await API.get('/api/financeiro?' + params);
  if (!res.ok) { toast('Erro ao carregar financeiro', 'error'); return; }
  finState.dados = res;
  finState.lancamentos = res.lancamentos || [];
  renderFinanceiro();
  popularFinMedicos();
}

function renderFinanceiro() {
  const d = finState.dados;
  if (!d) return;
  const r = d.resumo;

  document.getElementById('fin-receita').textContent   = fmt_brl(r.total_receita || 0);
  document.getElementById('fin-despesa').textContent   = fmt_brl(r.total_despesa || 0);
  document.getElementById('fin-resultado').textContent = fmt_brl((r.receita_confirmada||0) - (r.total_despesa||0));
  document.getElementById('fin-pendente').textContent  = fmt_brl(r.receita_pendente || 0);

  const tbMed = document.getElementById('fin-med-tbody');
  if (tbMed) {
    const medList = auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id
      ? (d.porMedico||[]).filter(m => m.nome === auth.usuario.nome)
      : (d.porMedico||[]);
    const maxVal = Math.max(...medList.map(m=>m.total), 1);
    tbMed.innerHTML = medList.map(m => `
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
        <td><button class="btn btn-sm" onclick="imprimirFinanceiro(${m.id})" title="Imprimir relatório deste médico">🖨️</button></td>
      </tr>`).join('') || '<tr><td colspan="4" class="tbl-empty">Nenhum dado</td></tr>';
  }

  const tbConv = document.getElementById('fin-conv-tbody');
  if (tbConv) {
    tbConv.innerHTML = (d.porConvenio||[]).map(c => `
      <tr>
        <td><span class="badge badge-blue">${c.categoria}</span></td>
        <td>${c.qtd}</td>
        <td style="font-weight:500">${fmt_brl(c.total)}</td>
      </tr>`).join('') || '<tr><td colspan="3" class="tbl-empty">Nenhum dado</td></tr>';
  }

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

function newLancamento() {
  state.editingId = null; state.editingType = 'lancamento';
  document.getElementById('fl-form').reset();
  document.getElementById('fl-data').value = new Date().toISOString().slice(0,10);
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

function popularFinMedicos() {
  const sel = document.getElementById('fin-medico-sel');
  if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="">Todos os médicos</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  sel.value = val;
}

// ══════════════════════════════════════════════
// IMPRESSÃO FINANCEIRO — CORRIGIDA
// ══════════════════════════════════════════════
function imprimirFinanceiro(medicoId) {
  const ini = document.getElementById('fin-data-ini').value;
  const fim = document.getElementById('fin-data-fim').value;
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
  const fmtBRL  = v => Number(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  let lancs = finState.lancamentos || [];
  let titulo = 'Relatório Financeiro Geral';
  let subtitulo = '';

  if (medicoId) {
    const med = state.medicos.find(m => m.id == medicoId);
    lancs = lancs.filter(l => l.medico_id == medicoId);
    titulo = 'Relatório Financeiro — ' + (med ? med.nome : '');
    subtitulo = med ? med.especialidade : '';
  }

  const receitas  = lancs.filter(l => l.tipo === 'receita');
  const despesas  = lancs.filter(l => l.tipo === 'despesa');
  const totalRec  = receitas.reduce((s,l) => s + (l.valor||0), 0);
  const totalDesp = despesas.reduce((s,l) => s + (l.valor||0), 0);
  const resultado = totalRec - totalDesp;
  const pendente  = lancs.filter(l=>l.status==='pendente').reduce((s,l)=>s+(l.valor||0),0);

  // Agrupamentos
  const porMedico = {};
  receitas.forEach(l => {
    const nome = l.medico_nome || 'Sem médico';
    if (!porMedico[nome]) porMedico[nome] = { qtd:0, total:0, pacientes:[] };
    porMedico[nome].qtd++;
    porMedico[nome].total += l.valor||0;
    if (l.descricao && !porMedico[nome].pacientes.includes(l.descricao))
      porMedico[nome].pacientes.push(l.descricao);
  });

  const porConvenio = {};
  receitas.forEach(l => {
    const cat = l.categoria || 'Particular';
    if (!porConvenio[cat]) porConvenio[cat] = { qtd:0, total:0 };
    porConvenio[cat].qtd++;
    porConvenio[cat].total += l.valor||0;
  });

  const rowsMedico = Object.entries(porMedico).map(([nome, d]) =>
    `<tr><td>${nome}</td><td style="text-align:center">${d.qtd}</td><td>${fmtBRL(d.total)}</td><td>${d.pacientes.slice(0,3).join(', ')}${d.pacientes.length>3?' +' + (d.pacientes.length-3) + ' mais':''}</td></tr>`
  ).join('') || '<tr><td colspan="4" style="color:#aaa;text-align:center;padding:12px">Nenhum dado</td></tr>';

  const rowsConvenio = Object.entries(porConvenio).map(([cat, d]) =>
    `<tr><td>${cat}</td><td style="text-align:center">${d.qtd}</td><td>${fmtBRL(d.total)}</td></tr>`
  ).join('') || '<tr><td colspan="3" style="color:#aaa;text-align:center;padding:12px">Nenhum dado</td></tr>';

  const rowsLanc = lancs.map(l =>
    `<tr>
      <td>${fmtDate(l.data)}</td>
      <td><span class="badge ${l.tipo==='receita'?'rec':'desp'}">${l.tipo}</span></td>
      <td>${l.descricao||'—'}</td>
      <td>${l.medico_nome||'—'}</td>
      <td>${l.categoria||'—'}</td>
      <td><span class="badge ${l.status==='confirmado'?'conf':'pend'}">${l.status||'—'}</span></td>
      <td class="${l.tipo==='receita'?'val-rec':'val-desp'}">${l.tipo==='receita'?'+':'-'} ${fmtBRL(l.valor)}</td>
    </tr>`
  ).join('') || '<tr><td colspan="7" style="color:#aaa;text-align:center;padding:12px">Nenhum lançamento</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${titulo}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; background:#fff; }

  /* Cabeçalho */
  .header { border-bottom: 3px solid #185FA5; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 20px; color: #185FA5; margin-bottom: 2px; }
  .header h2 { font-size: 14px; color: #555; font-weight: normal; margin-bottom: 4px; }
  .periodo { font-size: 12px; color: #777; }

  /* Cards de métricas */
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .metric { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; }
  .metric-label { font-size: 11px; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.3px; }
  .metric-val { font-size: 17px; font-weight: bold; }
  .verde   { color: #1a7a3a; }
  .vermelho{ color: #b03020; }
  .azul    { color: #185FA5; }
  .amarelo { color: #8a6200; }

  /* Seções */
  h3 { font-size: 14px; color: #185FA5; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #185FA5; }

  /* Tabelas */
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 12px; }
  thead th { background: #EEF3FB; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; color: #185FA5; border-bottom: 2px solid #c5d6ef; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: middle; line-height: 1.4; }
  tbody tr:last-child td { border-bottom: none; }
  tfoot td { padding: 8px 10px; font-weight: bold; background: #f5f7fb; font-size: 13px; border-top: 2px solid #c5d6ef; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge.rec  { background: #e2f5eb; color: #1a7a3a; }
  .badge.desp { background: #fde8e5; color: #b03020; }
  .badge.conf { background: #e2f5eb; color: #1a7a3a; }
  .badge.pend { background: #fef4d4; color: #8a6200; }

  /* Valores coloridos */
  .val-rec  { color: #1a7a3a; font-weight: 600; text-align: right; }
  .val-desp { color: #b03020; font-weight: 600; text-align: right; }

  /* Rodapé */
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; }

  @media print {
    body { font-size: 13px; }
    .no-print { display: none; }
    h3 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>🏥 ClinicaAOGIC — ${titulo}</h1>
  ${subtitulo ? `<h2>${subtitulo}</h2>` : ''}
  <div class="periodo">
    Período: <strong>${fmtDate(ini)}</strong> a <strong>${fmtDate(fim)}</strong>
    &nbsp;|&nbsp; Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
  </div>
</div>

<div class="metrics">
  <div class="metric">
    <div class="metric-label">Total Receitas</div>
    <div class="metric-val verde">${fmtBRL(totalRec)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Total Despesas</div>
    <div class="metric-val vermelho">${fmtBRL(totalDesp)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Resultado</div>
    <div class="metric-val azul">${fmtBRL(resultado)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">A Receber</div>
    <div class="metric-val amarelo">${fmtBRL(pendente)}</div>
  </div>
</div>

<h3>Receita por Médico</h3>
<table>
  <thead><tr><th>Médico</th><th style="text-align:center">Consultas</th><th>Total</th><th>Pacientes</th></tr></thead>
  <tbody>${rowsMedico}</tbody>
</table>

<h3>Receita por Convênio</h3>
<table>
  <thead><tr><th>Convênio</th><th style="text-align:center">Qtd</th><th>Total</th></tr></thead>
  <tbody>${rowsConvenio}</tbody>
</table>

<h3>Lançamentos Detalhados</h3>
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Tipo</th>
      <th>Descrição</th>
      <th>Médico</th>
      <th>Categoria</th>
      <th>Status</th>
      <th style="text-align:right">Valor</th>
    </tr>
  </thead>
  <tbody>${rowsLanc}</tbody>
  <tfoot>
    <tr>
      <td colspan="6">Resultado do período</td>
      <td style="text-align:right;color:${resultado>=0?'#1a7a3a':'#b03020'}">${fmtBRL(resultado)}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  ClinicaAOGIC — Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
</div>

</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// ══════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════
async function loadUsuarios() {
  if (!state.medicos.length) await loadMedicos();
  try {
    const r = await fetch('/api/usuarios');
    const res = await r.json();
    if (!res.ok) { toast('Erro ao carregar usuários', 'error'); return; }
    renderUsuarios(res.data);
  } catch(e) { toast('Erro ao carregar usuários', 'error'); }
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
  if (auth.usuario?.perfil === 'secretaria') {
    toast('Acesso negado — LGPD: secretaria não pode acessar prontuários', 'error');
    return;
  }
  const pac = state.pacientes.find(p => p.id == pacienteId);
  if (!pac) return;
  prontState.pacienteAtual = pac;

  document.getElementById('prnt-pac-nome').textContent = pac.nome;
  document.getElementById('prnt-pac-info').textContent =
    `${pac.cpf} · ${fmt_date(pac.nascimento)} · ${pac.convenio}`;

  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-prontuario').classList.add('active');
  document.getElementById('topbar-title').textContent = 'Prontuário';
  document.getElementById('btn-add').textContent = '+ Nova Consulta';
  document.getElementById('btn-add').style.display = '';
  document.getElementById('search-input').style.display = 'none';

  await loadProntuarios(pacienteId);
  await loadDocumentos(pacienteId);
  await loadArquivos(pacienteId);
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
  container.innerHTML = prontState.prontuarios.map(p => {
    const podeEditar = auth.usuario?.perfil !== 'medico' || p.medico_id === auth.usuario?.medico_id;
    return `
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
          ${(podeEditar && auth.usuario?.perfil !== 'secretaria') ? `<button class="btn btn-sm" onclick="event.stopPropagation();editProntuario(${p.id})">✎ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDeleteProntuario(${p.id})">🗑</button>` : `<span style="font-size:11px;color:var(--sub);font-style:italic">Só leitura</span>`}
        </div>
      </div>
      ${p.hipotese_diagnostica ? `<div class="prnt-diag"><span class="badge badge-blue">CID: ${p.cid||'—'}</span> ${p.hipotese_diagnostica}</div>` : ''}
      ${p.queixa_principal ? `<div class="prnt-queixa">${p.queixa_principal}</div>` : ''}
      ${p.prescricao ? `<div class="prnt-prescricao"><strong>Prescrição:</strong> ${p.prescricao.slice(0,120)}${p.prescricao.length>120?'...':''}</div>` : ''}
      ${p.retorno_dias ? `<div style="font-size:11px;color:var(--teal);margin-top:6px">Retorno em ${p.retorno_dias} dias</div>` : ''}
    </div>
  `;
  }).join('');
}

function verProntuario(id) {
  const p = prontState.prontuarios.find(x => x.id === id);
  if (!p) return;
  if (auth.usuario?.perfil === 'secretaria') {
    toast('Prontuário — apenas leitura para secretaria', 'error');
    return;
  }
  editProntuario(id);
}

async function newProntuario() {
  state.editingId = null; state.editingType = 'prontuario';
  if (!state.medicos.length) await loadMedicos();
  document.getElementById('fp-form').reset();
  document.getElementById('fp-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('fp-paciente').value = prontState.pacienteAtual?.id || '';
  document.getElementById('fp-medico').innerHTML =
    '<option value="">Selecione o médico...</option>' +
    state.medicos.filter(m=>m.status==='ativo').map(m=>`<option value="${m.id}">${m.nome} — ${m.especialidade}</option>`).join('');
  // Pré-selecionar médico logado
  if (auth.usuario?.perfil === 'medico' && auth.usuario?.medico_id) {
    document.getElementById('fp-medico').value = auth.usuario.medico_id;
  }
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

async function acharHorarioLivre(medicoId, data) {
  // Buscar agendamentos do médico naquele dia
  const res = await API.get('/api/agendamentos?data=' + data + '&medico_id=' + medicoId);
  const agendamentos = res.ok ? (res.data || []) : [];

  // Horários padrão da agenda
  const horasPadrao = [
    '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
    '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30','18:00'
  ];

  const horasOcupadas = agendamentos.map(a => a.hora);

  // Tentar achar horário padrão livre
  for (const h of horasPadrao) {
    if (!horasOcupadas.includes(h)) return h;
  }

  // Todos os horários padrão ocupados — pegar último e adicionar 1 minuto
  if (agendamentos.length > 0) {
    const ultHora = agendamentos
      .map(a => a.hora)
      .sort()
      .pop(); // último horário
    const [hh, mm] = ultHora.split(':').map(Number);
    const totalMin = hh * 60 + mm + 1;
    const novoHH = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const novoMM = String(totalMin % 60).padStart(2, '0');
    return novoHH + ':' + novoMM;
  }

  return '08:00'; // fallback
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

  // ── Se nova consulta, verificar se já existe agendamento realizado no dia ──
  if (!state.editingId) {
    // Buscar paciente pelo ID do prontuário (não pelo prontState que pode estar desatualizado)
    const pac = state.pacientes.find(p => p.id === data.paciente_id) || prontState.pacienteAtual;
    const agExistente = state.agendamentos.find(a =>
      a.paciente_id === data.paciente_id &&
      a.medico_id === data.medico_id &&
      a.data === data.data_consulta &&
      a.status_agenda === 'realizado'
    );

    if (!agExistente) {
      // Buscar horário livre para o médico naquele dia
      const horaLivre = await acharHorarioLivre(data.medico_id, data.data_consulta);

      // Criar agendamento automático como "realizado"
      const agRes = await API.post('/api/agendamentos', {
        paciente_id:   data.paciente_id,
        medico_id:     data.medico_id,
        data:          data.data_consulta,
        hora:          horaLivre,
        duracao_min:   30,
        tipo:          'Consulta',
        valor:         pac?.valor_consulta || 0,
        status_pgto:   'pendente',
        status_agenda: 'realizado',
        observacoes:   'Gerado automaticamente via prontuário'
      });

      if (agRes.ok) {
        // Criar lançamento financeiro pendente
        await API.post('/api/financeiro', {
          tipo:          'receita',
          categoria:     pac?.convenio || 'Particular',
          descricao:     `Consulta — ${pac?.nome || 'Paciente'} (Consulta)`,
          valor:         pac?.valor_consulta || 0,
          data:          data.data_consulta,
          medico_id:     data.medico_id,
          agendamento_id: agRes.id,
          status:        'pendente',
          forma_pgto:    'pendente',
          observacoes:   'Gerado automaticamente via prontuário'
        });
        toast('Consulta registrada! Agendamento e lançamento financeiro criados automaticamente.', 'success');
      } else {
        toast('Consulta registrada! (Atenção: lançamento financeiro não foi criado)', 'error');
      }
    } else {
      toast('Consulta registrada!');
    }
  } else {
    toast('Consulta atualizada!');
  }

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

function abrirProntuarioAgendamento(agendamentoId) {
  if (auth.usuario?.perfil === 'secretaria') {
    toast('Acesso negado — LGPD: secretaria não pode acessar prontuários', 'error');
    return;
  }
  const ag = state.agendamentos.find(a => a.id === agendamentoId);
  if (!ag) return;
  const pac = state.pacientes.find(p => p.id === ag.paciente_id);
  if (pac) abrirProntuario(pac.id);
}



// ══════════════════════════════════════════════
// ARQUIVOS (Upload de exames e fotos)
// ══════════════════════════════════════════════
async function loadArquivos(pacienteId) {
  const res = await API.get('/api/arquivos?paciente_id=' + pacienteId);
  if (!res.ok) return;
  renderArquivos(res.data);
}

function renderArquivos(arquivos) {
  const container = document.getElementById('arq-lista');
  if (!container) return;
  if (!arquivos.length) {
    container.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:8px;text-align:center">Nenhum arquivo</div>';
    return;
  }
  container.innerHTML = arquivos.map(a => {
    const isPdf = a.tipo_mime === 'application/pdf';
    const isImg = a.tipo_mime.startsWith('image/');
    const icone = isPdf ? '📄' : isImg ? '🖼️' : '📎';
    const tam   = a.tamanho < 1024*1024 ? Math.round(a.tamanho/1024) + ' KB' : (a.tamanho/1024/1024).toFixed(1) + ' MB';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
      <span style="font-size:20px">${icone}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome_original}</div>
        <div style="font-size:11px;color:var(--sub)">${tam} · ${fmt_date(a.criado_em?.slice(0,10))}${a.descricao ? ' · ' + a.descricao : ''}</div>
      </div>
      <button class="btn btn-sm" onclick="visualizarArquivo(${a.id})" style="padding:3px 8px;font-size:11px" title="Visualizar">👁️</button>
      <button class="btn btn-sm btn-danger" onclick="confirmDeleteArquivo(${a.id},'${a.nome_original.replace(/'/g,"\'")}')">🗑</button>
    </div>`;
  }).join('');
}

function visualizarArquivo(id) {
  window.open('/api/arquivos/' + id + '?download=1', '_blank');
}

async function confirmDeleteArquivo(id, nome) {
  if (!confirm(`Excluir "${nome}"?`)) return;
  const res = await API.del('/api/arquivos/' + id);
  if (!res.ok) { toast('Erro ao excluir', 'error'); return; }
  toast('Arquivo excluído');
  if (prontState.pacienteAtual) loadArquivos(prontState.pacienteAtual.id);
}

async function uploadArquivo() {
  const input = document.getElementById('arq-input');
  const desc  = document.getElementById('arq-desc').value.trim();
  const file  = input.files[0];
  if (!file) { toast('Selecione um arquivo', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('Arquivo muito grande — máximo 2MB', 'error'); return; }

  const btn = document.getElementById('btn-upload-arq');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('paciente_id', prontState.pacienteAtual?.id);
  formData.append('descricao', desc);

  const r = await fetch('/api/arquivos', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${auth.token}` },
    body: formData
  });
  const res = await r.json();

  btn.disabled = false; btn.textContent = '⬆️ Enviar';

  if (!res.ok) { toast(res.error || 'Erro ao enviar', 'error'); return; }
  toast('Arquivo enviado com sucesso!');
  input.value = '';
  document.getElementById('arq-desc').value = '';
  if (prontState.pacienteAtual) loadArquivos(prontState.pacienteAtual.id);
}

// ══════════════════════════════════════════════
// DOCUMENTOS (Atestados, Exames, Receitas)
// ══════════════════════════════════════════════
const docState = { tipo: null, prontuarioId: null, editingId: null };

function novoDocumento(tipo, prontuarioId) {
  docState.tipo = tipo;
  docState.prontuarioId = prontuarioId || null;
  docState.editingId = null;
  document.getElementById('doc-conteudo').value = '';
  document.getElementById('doc-data').value = new Date().toISOString().slice(0, 10);
  const titulos = { atestado: '📄 Atestado Médico', exames: '🔬 Pedido de Exames', receita: '💊 Receita Médica' };
  document.getElementById('modal-doc-title').textContent = titulos[tipo] || 'Novo Documento';
  document.getElementById('modal-doc-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('doc-conteudo').focus(), 100);
}

async function editDocumento(id) {
  const res = await API.get('/api/documentos/' + id);
  if (!res.ok) { toast('Erro ao carregar documento', 'error'); return; }
  const d = res.data;
  docState.tipo = d.tipo;
  docState.prontuarioId = d.prontuario_id;
  docState.editingId = id;
  document.getElementById('doc-conteudo').value = d.conteudo;
  document.getElementById('doc-data').value = d.data;
  const titulos = { atestado: '📄 Atestado Médico', exames: '🔬 Pedido de Exames', receita: '💊 Receita Médica' };
  document.getElementById('modal-doc-title').textContent = 'Editar — ' + (titulos[d.tipo] || d.tipo);
  document.getElementById('modal-doc-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModalDoc() {
  document.getElementById('modal-doc-overlay').classList.remove('open');
  document.body.style.overflow = '';
  docState.editingId = null;
}

async function saveDocumento() {
  const conteudo = document.getElementById('doc-conteudo').value.trim();
  const data     = document.getElementById('doc-data').value;
  if (!conteudo) { toast('Preencha o conteúdo do documento', 'error'); return; }

  const btn = document.getElementById('btn-save-doc');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

  let res;
  if (docState.editingId) {
    res = await API.put('/api/documentos/' + docState.editingId, { conteudo, data });
  } else {
    res = await API.post('/api/documentos', {
      prontuario_id: docState.prontuarioId,
      paciente_id:   prontState.pacienteAtual?.id,
      medico_id:     auth.usuario?.medico_id || null,
      tipo:          docState.tipo,
      conteudo,
      data
    });
  }

  btn.disabled = false; btn.textContent = 'Salvar';
  if (!res.ok) { toast(res.error || 'Erro ao salvar', 'error'); return; }
  toast('Documento salvo!');
  closeModalDoc();
  if (prontState.pacienteAtual) loadDocumentos(prontState.pacienteAtual.id);
}

async function confirmDeleteDocumento(id) {
  if (!confirm('Excluir este documento?')) return;
  const res = await API.del('/api/documentos/' + id);
  if (!res.ok) { toast('Erro ao excluir', 'error'); return; }
  toast('Documento excluído');
  if (prontState.pacienteAtual) loadDocumentos(prontState.pacienteAtual.id);
}

async function loadDocumentos(pacienteId) {
  const res = await API.get('/api/documentos?paciente_id=' + pacienteId);
  if (!res.ok) return;
  renderDocumentos(res.data);
}

function renderDocumentos(docs) {
  const container = document.getElementById('doc-lista');
  if (!container) return;
  if (!docs.length) {
    container.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:8px;text-align:center">Nenhum documento</div>';
    return;
  }
  const icones = { atestado: '📄', exames: '🔬', receita: '💊' };
  const labels = { atestado: 'Atestado', exames: 'Pedido de Exames', receita: 'Receita' };
  container.innerHTML = docs.map(d => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
      <span style="font-size:18px">${icones[d.tipo]||'📄'}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:500">${labels[d.tipo]||d.tipo}</div>
        <div style="font-size:11px;color:var(--sub)">${fmt_date(d.data)} · ${d.medico_nome||''}</div>
      </div>
      <button class="btn btn-sm" onclick="imprimirDocumentoId(${d.id})" title="Imprimir" style="padding:3px 8px;font-size:11px">🖨️</button>
      <button class="btn btn-sm" onclick="editDocumento(${d.id})" style="padding:3px 8px;font-size:11px">✎</button>
      <button class="btn btn-sm btn-danger" onclick="confirmDeleteDocumento(${d.id})" style="padding:3px 8px;font-size:11px">🗑</button>
    </div>
  `).join('');
}

function imprimirDocumento() {
  const conteudo = document.getElementById('doc-conteudo').value.trim();
  if (!conteudo) { toast('Preencha o conteúdo antes de imprimir', 'error'); return; }
  const pac = prontState.pacienteAtual;
  const med = auth.usuario;
  const data = document.getElementById('doc-data').value;
  const titulos = { atestado: 'ATESTADO MÉDICO', exames: 'PEDIDO DE EXAMES', receita: 'RECEITA MÉDICA' };
  gerarImpressaoDoc(titulos[docState.tipo] || 'DOCUMENTO', conteudo, pac, med, data);
}

async function imprimirDocumentoId(id) {
  const res = await API.get('/api/documentos/' + id);
  if (!res.ok) { toast('Erro', 'error'); return; }
  const d = res.data;
  const titulos = { atestado: 'ATESTADO MÉDICO', exames: 'PEDIDO DE EXAMES', receita: 'RECEITA MÉDICA' };
  gerarImpressaoDoc(titulos[d.tipo] || 'DOCUMENTO', d.conteudo, { nome: d.paciente_nome, nascimento: d.paciente_nascimento }, { nome: d.medico_nome, medico_crm: d.medico_crm, especialidade: d.especialidade }, d.data);
}

function gerarImpressaoDoc(titulo, conteudo, pac, med, data) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${titulo}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
  .header { border-bottom: 2px solid #185FA5; padding-bottom: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:flex-end; }
  .clinica { font-size:18px; font-weight:bold; color:#185FA5; }
  .medico { text-align:right; font-size:12px; color:#555; }
  .titulo { text-align:center; font-size:16px; font-weight:bold; letter-spacing:2px; margin:20px 0; padding:10px; border:1.5px solid #185FA5; border-radius:6px; color:#185FA5; }
  .paciente { background:#f5f7fb; border-radius:6px; padding:10px 14px; margin-bottom:20px; font-size:12px; }
  .paciente strong { color:#185FA5; }
  .conteudo { font-size:13px; line-height:1.8; white-space:pre-wrap; min-height:180px; }
  .footer { margin-top:60px; border-top:1px solid #ddd; padding-top:16px; display:flex; justify-content:space-between; align-items:flex-end; }
  .assinatura { text-align:center; }
  .assinatura-linha { border-top:1px solid #333; width:220px; margin:0 auto 6px; padding-top:6px; font-size:12px; }
  .data-local { font-size:11px; color:#777; }
</style>
</head>
<body>
<div class="header">
  <div class="clinica">🏥 ClinicaAOGIC</div>
  <div class="medico">
    <div><strong>${med?.nome || ''}</strong></div>
    <div>CRM: ${med?.medico_crm || med?.crm || '—'}</div>
    <div>${med?.especialidade || ''}</div>
  </div>
</div>
<div class="titulo">${titulo}</div>
<div class="paciente">
  <strong>Paciente:</strong> ${pac?.nome || '—'} &nbsp;|&nbsp;
  <strong>Nascimento:</strong> ${fmt_date(pac?.nascimento) || '—'}
</div>
<div class="conteudo">${conteudo}</div>
<div class="footer">
  <div class="data-local">Data: ${fmt_date(data) || new Date().toLocaleDateString('pt-BR')}</div>
  <div class="assinatura">
    <div class="assinatura-linha">${med?.nome || ''}</div>
    <div style="font-size:11px;color:#555">CRM ${med?.medico_crm || med?.crm || '—'}</div>
  </div>
</div>
</body>
</html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ══════════════════════════════════════════════
// WHATSAPP
// ══════════════════════════════════════════════
function limparTelefone(tel) {
  const nums = tel.replace(/[^0-9]/g, '');
  if (nums.startsWith('55')) return nums;
  return '55' + nums;
}

function abrirWhatsApp(telefone, mensagem) {
  const tel = limparTelefone(telefone);
  const msg = encodeURIComponent(mensagem);
  window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
}

async function enviarAgendaMedico(medicoId) {
  const med = state.medicos.find(m => m.id == medicoId);
  if (!med) return;
  if (!med.telefone) { toast('Médico sem telefone cadastrado!', 'error'); return; }

  const res = await API.get(`/api/agendamentos?data=${state.agendaDate}&medico_id=${medicoId}`);
  if (!res.ok) { toast('Erro ao carregar agenda', 'error'); return; }

  const ags = res.data;
  const dataFmt = new Date(state.agendaDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });

  const dataSimples = new Date(state.agendaDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
  let msg = `Agenda ${dataSimples} — ${med.nome.split(' ')[0]} ${med.nome.split(' ').slice(-1)[0]}\n`;

  const ativos = ags.filter(a => a.status_agenda !== 'cancelado');
  if (!ativos.length) {
    msg += `Sem consultas hoje.`;
  } else {
    ativos.forEach(ag => {
      msg += `${ag.hora} ${ag.paciente_nome}\n`;
    });
  }
  abrirWhatsApp(med.telefone, msg);
}

function enviarLembreteConsulta(agendamentoId) {
  const ag = state.agendamentos.find(a => a.id == agendamentoId);
  if (!ag) return;
  const pac = state.pacientes.find(p => p.id == ag.paciente_id);
  if (!pac) { toast('Paciente não encontrado', 'error'); return; }
  if (!pac.telefone) { toast('Paciente sem telefone cadastrado!', 'error'); return; }

  const dataFmt = new Date(ag.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const med = state.medicos.find(m => m.id == ag.medico_id);

  let msg = `Olá, *${pac.nome}*! 👋\n\n`;
  msg += `🏥 *Lembrete de Consulta*\n\n`;
  msg += `📅 *Data:* ${dataFmt}\n`;
  msg += `🕐 *Horário:* ${ag.hora}\n`;
  msg += `👨‍⚕️ *Médico:* ${ag.medico_nome || med?.nome || ''}\n`;
  msg += `🩺 *Especialidade:* ${ag.especialidade || med?.especialidade || ''}\n`;
  msg += `📋 *Tipo:* ${ag.tipo}\n\n`;
  msg += `Por favor, chegue com 10 minutos de antecedência.\n\n`;
  msg += `Em caso de dúvidas ou necessidade de remarcar, entre em contato.\n\n`;
  msg += `_ClinicaAOGIC_`;

  abrirWhatsApp(pac.telefone, msg);
}

async function enviarAgendaCompleta() {
  const res = await API.get(`/api/agendamentos?data=${state.agendaDate}`);
  if (!res.ok) { toast('Erro ao carregar agenda', 'error'); return; }

  const ags = res.data.filter(a => a.status_agenda !== 'cancelado');
  const dataFmt = new Date(state.agendaDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  if (!ags.length) { toast('Nenhum agendamento para hoje', 'error'); return; }

  let msg = `🏥 *ClinicaAOGIC — Agenda Completa*\n`;
  msg += `📅 ${dataFmt}\n\n`;
  msg += `*Total: ${ags.length} consulta(s)*\n\n`;

  const porMedico = {};
  ags.forEach(ag => {
    if (!porMedico[ag.medico_nome]) porMedico[ag.medico_nome] = [];
    porMedico[ag.medico_nome].push(ag);
  });

  Object.entries(porMedico).forEach(([nome, consultas]) => {
    msg += `👨‍⚕️ *${nome}*\n`;
    consultas.forEach(ag => {
      msg += `   🕐 ${ag.hora} — ${ag.paciente_nome} (${ag.tipo})\n`;
    });
    msg += '\n';
  });

  msg += `_Enviado pelo ClinicaAOGIC_`;

  navigator.clipboard.writeText(msg).then(() => {
    toast('Agenda copiada! Cole no WhatsApp.');
  }).catch(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

// ══════════════════════════════════════════════
// TROCAR SENHA
// ══════════════════════════════════════════════
function abrirTrocarSenha() {
  document.getElementById('ts-atual').value = '';
  document.getElementById('ts-nova').value = '';
  document.getElementById('ts-confirma').value = '';
  document.getElementById('ts-erro').textContent = '';
  document.getElementById('modal-senha-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharTrocarSenha() {
  document.getElementById('modal-senha-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function salvarNovaSenha() {
  const atual    = document.getElementById('ts-atual').value;
  const nova     = document.getElementById('ts-nova').value;
  const confirma = document.getElementById('ts-confirma').value;
  const erro     = document.getElementById('ts-erro');

  if (!atual || !nova || !confirma) { erro.textContent = 'Preencha todos os campos'; return; }
  if (nova.length < 6) { erro.textContent = 'A nova senha deve ter pelo menos 6 caracteres'; return; }
  if (nova !== confirma) { erro.textContent = 'A confirmação não confere com a nova senha'; return; }

  const btn = document.getElementById('btn-salvar-senha');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

  const checkRes = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auth.usuario.email, senha: atual })
  });
  const checkData = await checkRes.json();

  if (!checkData.ok) {
    btn.disabled = false; btn.textContent = 'Salvar';
    erro.textContent = 'Senha atual incorreta';
    return;
  }

  const res = await API.put('/api/usuarios/' + auth.usuario.id, {
    nome:      auth.usuario.nome,
    email:     auth.usuario.email,
    senha:     nova,
    perfil:    auth.usuario.perfil,
    medico_id: auth.usuario.medico_id,
    ativo:     1
  });

  btn.disabled = false; btn.textContent = 'Salvar';

  if (!res.ok) { erro.textContent = res.error || 'Erro ao salvar'; return; }

  toast('Senha alterada com sucesso!');
  fecharTrocarSenha();
}
