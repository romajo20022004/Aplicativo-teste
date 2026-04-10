// public/js/app.js

// ── Estado global ──────────────────────────────────────────────
const state = {
  pacientes: [],
  loading: false,
  editingId: null,
  role: 'admin'
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

function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatarColor(name) {
  const colors = ['av-blue', 'av-teal', 'av-coral', 'av-amber'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function maskCPF(v) {
  return v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
}
function maskPhone(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
  return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}
function maskCEP(v) {
  return v.replace(/\D/g, '').replace(/(\d{5})(\d{1,3})/, '$1-$2').slice(0, 9);
}

// ── API ───────────────────────────────────────────────────────
const API = {
  async get(path) {
    const r = await fetch(path);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: 'DELETE' });
    return r.json();
  }
};

// ── Navegação ──────────────────────────────────────────────────
const PAGES = {
  pacientes: { title: 'Pacientes', addBtn: '+ Novo Paciente', showSearch: true },
  agenda:    { title: 'Agenda',    addBtn: '+ Novo Agendamento', showSearch: false },
  financeiro:{ title: 'Financeiro',addBtn: '+ Lançamento', showSearch: false },
  dashboard: { title: 'Dashboard', addBtn: '', showSearch: false }
};

function navTo(page) {
  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('sec-' + page);
  const btn = document.getElementById('nav-' + page);
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
}

// ── Pacientes — listar ─────────────────────────────────────────
async function loadPacientes() {
  const q = $('#search-input').value;
  const status = $('#filter-status').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const res = await API.get('/api/pacientes?' + params);
  if (!res.ok) { toast('Erro ao carregar pacientes', 'error'); return; }
  state.pacientes = res.data;
  renderTable();
  renderMetrics();
}

function renderTable() {
  const tbody = $('#pac-tbody');
  if (!state.pacientes.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">Nenhum paciente encontrado</td></tr>';
    return;
  }
  tbody.innerHTML = state.pacientes.map(p => `
    <tr>
      <td>
        <div class="flex-row">
          <div class="av ${avatarColor(p.nome)}">${initials(p.nome)}</div>
          <div>
            <div style="font-weight:500">${p.nome}</div>
            <div style="font-size:11px;color:var(--sub)">${p.cpf}</div>
          </div>
        </div>
      </td>
      <td>${fmt_date(p.nascimento)}</td>
      <td>${p.telefone}<br><span style="font-size:11px;color:var(--sub)">${p.email || ''}</span></td>
      <td><span class="badge ${convenio_badge(p.convenio)}">${p.convenio}</span></td>
      <td style="font-weight:500">${fmt_brl(p.valor_consulta)}</td>
      <td><span class="badge ${p.status === 'ativo' ? 'badge-teal' : 'badge-red'}">${p.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div class="flex-row">
          <button class="btn btn-sm" onclick="editPaciente(${p.id})" title="Editar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete(${p.id}, '${p.nome.replace(/'/g, "\\'")}')" title="Excluir">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function convenio_badge(conv) {
  const map = { 'Particular': 'badge-blue', 'Unimed': 'badge-teal', 'Bradesco Saúde': 'badge-amber', 'SulAmérica': 'badge-coral', 'Amil': 'badge-green' };
  return map[conv] || 'badge-blue';
}

function renderMetrics() {
  const total   = state.pacientes.length;
  const ativos  = state.pacientes.filter(p => p.status === 'ativo').length;
  const inativos= state.pacientes.filter(p => p.status === 'inativo').length;
  const ticket  = total ? state.pacientes.reduce((s, p) => s + (p.valor_consulta || 0), 0) / total : 0;
  $('#m-total').textContent   = total;
  $('#m-ativos').textContent  = ativos;
  $('#m-inativos').textContent= inativos;
  $('#m-ticket').textContent  = fmt_brl(ticket);
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(title) {
  $('#modal-title').textContent = title;
  $('#modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.editingId = null;
  resetForm();
}

function resetForm() {
  const form = $('#pac-form');
  form.reset();
  $$('.field-error', form).forEach(e => e.textContent = '');
  $$('.error', form).forEach(e => e.classList.remove('error'));
}

function formData() {
  return {
    nome:          $('#f-nome').value.trim(),
    nascimento:    $('#f-nascimento').value,
    cpf:           $('#f-cpf').value.trim(),
    sexo:          $('#f-sexo').value,
    telefone:      $('#f-telefone').value.trim(),
    email:         $('#f-email').value.trim(),
    cep:           $('#f-cep').value.trim(),
    logradouro:    $('#f-logradouro').value.trim(),
    numero:        $('#f-numero').value.trim(),
    complemento:   $('#f-complemento').value.trim(),
    bairro:        $('#f-bairro').value.trim(),
    cidade:        $('#f-cidade').value.trim(),
    estado:        $('#f-estado').value,
    convenio:      $('#f-convenio').value,
    num_carteira:  $('#f-num-carteira').value.trim(),
    valor_consulta:parseFloat($('#f-valor').value) || 0,
    status:        $('#f-status').value,
    observacoes:   $('#f-obs').value.trim()
  };
}

function validateForm(data) {
  let ok = true;
  const required = [
    ['f-nome',       'nome',       'Nome é obrigatório'],
    ['f-nascimento', 'nascimento', 'Data de nascimento é obrigatória'],
    ['f-cpf',        'cpf',        'CPF é obrigatório'],
    ['f-sexo',       'sexo',       'Sexo é obrigatório'],
    ['f-telefone',   'telefone',   'Telefone é obrigatório'],
    ['f-convenio',   'convenio',   'Convênio é obrigatório'],
  ];
  required.forEach(([id, field, msg]) => {
    const el = document.getElementById(id);
    const err = document.getElementById('err-' + field);
    if (!data[field]) {
      el.classList.add('error');
      if (err) err.textContent = msg;
      ok = false;
    } else {
      el.classList.remove('error');
      if (err) err.textContent = '';
    }
  });
  return ok;
}

function newPaciente() {
  state.editingId = null;
  resetForm();
  openModal('Novo Paciente');
  setTimeout(() => $('#f-nome').focus(), 100);
}

async function editPaciente(id) {
  const res = await API.get('/api/pacientes/' + id);
  if (!res.ok) { toast('Erro ao carregar paciente', 'error'); return; }
  const p = res.data;
  state.editingId = id;

  $('#f-nome').value        = p.nome || '';
  $('#f-nascimento').value  = p.nascimento || '';
  $('#f-cpf').value         = p.cpf || '';
  $('#f-sexo').value        = p.sexo || '';
  $('#f-telefone').value    = p.telefone || '';
  $('#f-email').value       = p.email || '';
  $('#f-cep').value         = p.cep || '';
  $('#f-logradouro').value  = p.logradouro || '';
  $('#f-numero').value      = p.numero || '';
  $('#f-complemento').value = p.complemento || '';
  $('#f-bairro').value      = p.bairro || '';
  $('#f-cidade').value      = p.cidade || '';
  $('#f-estado').value      = p.estado || '';
  $('#f-convenio').value    = p.convenio || 'Particular';
  $('#f-num-carteira').value= p.num_carteira || '';
  $('#f-valor').value       = p.valor_consulta || '';
  $('#f-status').value      = p.status || 'ativo';
  $('#f-obs').value         = p.observacoes || '';

  openModal('Editar Paciente — ' + p.nome);
}

async function savePaciente() {
  const data = formData();
  if (!validateForm(data)) return;

  const saveBtn = $('#btn-save');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner"></div>';

  let res;
  if (state.editingId) {
    res = await API.put('/api/pacientes/' + state.editingId, data);
  } else {
    res = await API.post('/api/pacientes', data);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar';

  if (!res.ok) {
    toast(res.error || 'Erro ao salvar', 'error');
    return;
  }

  toast(state.editingId ? 'Paciente atualizado!' : 'Paciente cadastrado!');
  closeModal();
  loadPacientes();
}

async function confirmDelete(id, nome) {
  if (!confirm(`Excluir o paciente "${nome}"? Esta ação não pode ser desfeita.`)) return;
  const res = await API.del('/api/pacientes/' + id);
  if (!res.ok) { toast('Erro ao excluir', 'error'); return; }
  toast('Paciente excluído');
  loadPacientes();
}

// ── CEP lookup ─────────────────────────────────────────────────
async function lookupCEP(cep) {
  const raw = cep.replace(/\D/g, '');
  if (raw.length !== 8) return;
  const res = await API.get('/api/cep/' + raw);
  if (!res.ok) { toast('CEP não encontrado', 'error'); return; }
  const d = res.data;
  $('#f-logradouro').value = d.logradouro || '';
  $('#f-bairro').value     = d.bairro     || '';
  $('#f-cidade').value     = d.cidade     || '';
  $('#f-estado').value     = d.estado     || '';
  $('#f-numero').focus();
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Navegação
  $$('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navTo(btn.dataset.page));
  });

  // Botão add
  $('#btn-add').addEventListener('click', () => {
    const active = $$('.nav-item.active')[0]?.dataset.page;
    if (active === 'pacientes') newPaciente();
  });

  // Busca e filtro
  let searchTimer;
  $('#search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPacientes, 350);
  });
  $('#filter-status').addEventListener('change', loadPacientes);

  // Modal
  $('#btn-save').addEventListener('click', savePaciente);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', e => {
    if (e.target === $('#modal-overlay')) closeModal();
  });

  // Máscaras
  $('#f-cpf').addEventListener('input', function() { this.value = maskCPF(this.value); });
  $('#f-telefone').addEventListener('input', function() { this.value = maskPhone(this.value); });
  $('#f-cep').addEventListener('input', function() {
    this.value = maskCEP(this.value);
    if (this.value.replace(/\D/g, '').length === 8) lookupCEP(this.value);
  });

  // Role switch
  $('#role-select').addEventListener('change', function() {
    state.role = this.value;
    const finNav = $('#nav-financeiro');
    finNav.style.display = this.value === 'medico' ? 'none' : '';
  });

  // Init
  navTo('pacientes');
  loadPacientes();
});
