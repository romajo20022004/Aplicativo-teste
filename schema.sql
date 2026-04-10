-- schema.sql
-- Execute com: wrangler d1 execute clinica-db --file=schema.sql

CREATE TABLE IF NOT EXISTS pacientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  nascimento  TEXT NOT NULL,
  cpf         TEXT UNIQUE NOT NULL,
  sexo        TEXT NOT NULL CHECK(sexo IN ('M','F','O')),
  telefone    TEXT NOT NULL,
  email       TEXT,

  -- endereço
  cep         TEXT,
  logradouro  TEXT,
  numero      TEXT,
  complemento TEXT,
  bairro      TEXT,
  cidade      TEXT,
  estado      TEXT,

  -- convênio e financeiro
  convenio    TEXT NOT NULL DEFAULT 'Particular',
  num_carteira TEXT,
  valor_consulta REAL NOT NULL DEFAULT 0,

  -- controle
  status      TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','inativo')),
  observacoes TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed com alguns pacientes de exemplo
INSERT OR IGNORE INTO pacientes (nome, nascimento, cpf, sexo, telefone, email, cep, logradouro, numero, bairro, cidade, estado, convenio, valor_consulta, status)
VALUES
  ('Maria Silva',     '1978-03-12', '111.222.333-44', 'F', '(11) 98765-4321', 'maria@email.com',  '01310-100', 'Av. Paulista',     '1000', 'Bela Vista',  'São Paulo', 'SP', 'Unimed',         280.00, 'ativo'),
  ('João Pereira',    '1955-07-05', '222.333.444-55', 'M', '(11) 91234-5678', 'joao@email.com',   '04038-001', 'R. Domingos de Morais', '500', 'Vila Mariana', 'São Paulo', 'SP', 'Bradesco Saúde', 350.00, 'ativo'),
  ('Ana Lima',        '1990-11-22', '333.444.555-66', 'F', '(11) 99887-6655', 'ana@email.com',    '05407-002', 'R. Oscar Freire',  '200', 'Jardins',     'São Paulo', 'SP', 'Particular',     350.00, 'ativo'),
  ('Rafael Oliveira', '1982-01-30', '444.555.666-77', 'M', '(11) 97766-5544', 'rafael@email.com', '01415-001', 'R. Augusta',       '750', 'Consolação',  'São Paulo', 'SP', 'SulAmérica',     300.00, 'ativo'),
  ('Carla Ferreira',  '1967-06-14', '555.666.777-88', 'F', '(11) 94433-2211', 'carla@email.com',  '04547-130', 'Av. Brigadeiro Faria Lima', '3000', 'Itaim Bibi', 'São Paulo', 'SP', 'Amil', 320.00, 'ativo'),
  ('Paulo Mendes',    '1944-09-09', '666.777.888-99', 'M', '(11) 92255-8877', '',                  '01001-000', 'Praça da Sé',      '100', 'Sé',          'São Paulo', 'SP', 'Unimed',         280.00, 'inativo');
