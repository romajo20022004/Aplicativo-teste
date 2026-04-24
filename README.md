# ClinicaApp 🏥
    
Sistema de gestão de consultório médico — Cloudflare Pages + D1 + Workers Functions.    
    
## Stack
- **Frontend**: HTML/CSS/JS puro (sem frameworks)
- **Backend**: Cloudflare Pages Functions (serverless)
- **Banco de dados**: Cloudflare D1 (SQLite na borda)
- **Deploy**: Cloudflare Pages (via GitHub)

## Estrutura do projeto

```
clinica/
├── public/                  # Frontend estático
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
├── functions/               # Cloudflare Pages Functions (API)
│   └── api/
│       ├── pacientes.js         # GET /api/pacientes, POST /api/pacientes
│       ├── pacientes/
│       │   └── [id].js          # GET/PUT/DELETE /api/pacientes/:id
│       └── cep/
│           └── [cep].js         # GET /api/cep/:cep (ViaCEP lookup)
├── schema.sql               # Schema do banco D1
└── wrangler.toml            # Configuração Cloudflare
```

## Setup passo a passo

### 1. Pré-requisitos
```bash
npm install -g wrangler
wrangler login
```

### 2. Criar banco D1
```bash
wrangler d1 create clinica-db
```
Copie o `database_id` retornado e cole no `wrangler.toml`.

### 3. Rodar o schema (criar tabelas + seed)
```bash
# Banco remoto (produção)
wrangler d1 execute clinica-db --file=schema.sql

# Banco local (desenvolvimento)
wrangler d1 execute clinica-db --local --file=schema.sql
```

### 4. Desenvolvimento local
```bash
wrangler pages dev public --d1=DB=clinica-db
```
Acesse: http://localhost:8788

### 5. GitHub + Cloudflare Pages (deploy automático)

1. Suba o projeto para um repositório GitHub:
```bash
git init
git add .
git commit -m "feat: projeto inicial ClinicaApp"
git remote add origin https://github.com/SEU_USER/clinica-app.git
git push -u origin main
```

2. No painel da Cloudflare:
   - Vá em **Pages → Create a project → Connect to Git**
   - Selecione o repositório `clinica-app`
   - **Build settings**:
     - Framework preset: `None`
     - Build command: *(deixar vazio)*
     - Build output directory: `public`
   - Clique em **Save and Deploy**

3. Após o deploy, vincule o banco D1:
   - Vá em **Settings → Functions → D1 database bindings**
   - Adicione: Variable name = `DB`, Database = `clinica-db`
   - Faça um novo deploy (ou aguarde o próximo push)

### 6. Push futuro = deploy automático
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push
```

## API endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/pacientes` | Lista todos (suporta `?q=busca&status=ativo`) |
| POST | `/api/pacientes` | Cadastra novo paciente |
| GET | `/api/pacientes/:id` | Busca paciente por ID |
| PUT | `/api/pacientes/:id` | Atualiza paciente |
| DELETE | `/api/pacientes/:id` | Remove paciente |
| GET | `/api/cep/:cep` | Busca endereço pelo CEP (ViaCEP) |

## Próximas etapas
- [ ] Módulo de Agenda (consultas por médico/dia)
- [ ] Módulo Financeiro (lançamentos vinculados a pacientes)
- [ ] Autenticação (Cloudflare Access ou JWT)
- [ ] Prontuário eletrônico
- [ ] Relatórios e exportação PDF
