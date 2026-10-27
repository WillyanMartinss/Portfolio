const express = require('express');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const envPath = path.resolve(__dirname, '.env.local');
const fallbackEnvPath = path.resolve(__dirname, '.env');
if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (require('fs').existsSync(fallbackEnvPath)) {
  dotenv.config({ path: fallbackEnvPath });
}

const app = express();
const PORT = process.env.PORT || 8000;
const DB_PATH = path.join(__dirname, 'portfolio.db');
const DATABASE_URL = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || '';
const usePostgres = Boolean(DATABASE_URL);
const SESSION_SECRET = process.env.SESSION_SECRET || 'portfolio-secret-change-me';

const baseData = {
  profile: {
    name: 'Seu Nome',
    title: 'Desenvolvedor Full Stack',
    bio: 'Sou desenvolvedor focado em criar experiências digitais modernas, funcionalidade clara e interfaces que entregam valor real para pessoas e negócios.',
    email: 'seuemail@email.com',
    phone: '(11) 99999-9999',
    city: 'São Paulo, SP',
    github: 'github.com/seuusuario',
    linkedin: 'linkedin.com/in/seuusuario'
  },
  skills: [
    { icon: '⚙️', title: 'Frontend', text: 'Criação de interfaces responsivas, acessíveis e bem pensadas para diversas telas e dispositivos.' },
    { icon: '🧠', title: 'UX/UI', text: 'Design focado em usabilidade, clareza visual e uma jornada eficiente para o usuário final.' },
    { icon: '💻', title: 'Backend', text: 'Lógica de negócio, APIs, autenticação, integrações e estrutura para aplicações escaláveis.' },
    { icon: '📦', title: 'Produtos', text: 'Transformo ideias em produtos úteis, com visão técnica, estratégica e de experiência.' }
  ],
  projects: [
    {
      title: 'Sistema de Gestão',
      description: 'Dashboard completo para organização de processos internos, relatórios e acompanhamento de indicadores em tempo real.',
      url: 'https://example.com',
      repo: 'https://github.com/example',
      image: '',
      tags: ['Dashboard', 'Web App', 'UX']
    },
    {
      title: 'Loja de E-commerce',
      description: 'Loja moderna com catálogo, carrinho, checkout e identidade visual alinhada ao posicionamento da marca.',
      url: 'https://example.com',
      repo: 'https://github.com/example',
      image: '',
      tags: ['E-commerce', 'React', 'Mobile']
    },
    {
      title: 'Portal de Conteúdo',
      description: 'Plataforma para publicação de artigos, categorias, busca e destaque de conteúdos por interesse do público.',
      url: 'https://example.com',
      repo: 'https://github.com/example',
      image: '',
      tags: ['CMS', 'Blog', 'SEO']
    }
  ],
  resume: {
    text: 'Profissional com foco em desenvolvimento de soluções digitais, experiência em produto, interface e arquitetura de software. Tenho trabalhado com criação de aplicações web, automação e melhorias contínuas para negócios e clientes.',
    link: ''
  }
};

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const normalizeUser = (value) => String(value || '').trim();
const currentAdminUser = normalizeUser(process.env.ADMIN_USER || 'admin');
const currentAdminPassword = process.env.ADMIN_PASS || 'Paramore20@x';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSiteData(data) {
  return {
    profile: data?.profile || deepClone(baseData.profile),
    skills: Array.isArray(data?.skills) ? data.skills : deepClone(baseData.skills),
    projects: Array.isArray(data?.projects) ? data.projects : deepClone(baseData.projects),
    resume: data?.resume || deepClone(baseData.resume)
  };
}

let sqliteDb = null;
let postgresPool = null;

function initializeSqliteDatabase() {
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS site_data (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
  `);

  const adminRow = sqliteDb.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!adminRow) {
    sqliteDb.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run(currentAdminUser, hash(currentAdminPassword));
  } else {
    sqliteDb.prepare('UPDATE admin SET username = ?, password_hash = ? WHERE id = 1').run(currentAdminUser, hash(currentAdminPassword));
  }

  const siteRow = sqliteDb.prepare('SELECT payload FROM site_data WHERE id = 1').get();
  if (!siteRow) {
    sqliteDb.prepare('INSERT INTO site_data (id, payload) VALUES (1, ?)').run(JSON.stringify(baseData));
  }

  return sqliteDb;
}

async function initializePostgresDatabase() {
  postgresPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false
  });

  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS site_data (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at BIGINT NOT NULL
    );
  `);

  const adminResult = await postgresPool.query('SELECT * FROM admin WHERE id = 1');
  if (!adminResult.rows.length) {
    await postgresPool.query('INSERT INTO admin (id, username, password_hash) VALUES (1, $1, $2)', [currentAdminUser, hash(currentAdminPassword)]);
  } else {
    await postgresPool.query('UPDATE admin SET username = $1, password_hash = $2 WHERE id = 1', [currentAdminUser, hash(currentAdminPassword)]);
  }

  const siteResult = await postgresPool.query('SELECT payload FROM site_data WHERE id = 1');
  if (!siteResult.rows.length) {
    await postgresPool.query('INSERT INTO site_data (id, payload) VALUES (1, $1)', [baseData]);
  }

  return postgresPool;
}

async function initializeDatabase() {
  if (usePostgres) {
    return initializePostgresDatabase();
  }
  return initializeSqliteDatabase();
}

function getSqliteSiteData() {
  const row = sqliteDb.prepare('SELECT payload FROM site_data WHERE id = 1').get();
  if (!row) return deepClone(baseData);
  try {
    return JSON.parse(row.payload);
  } catch {
    return deepClone(baseData);
  }
}

async function getPostgresSiteData() {
  const result = await postgresPool.query('SELECT payload FROM site_data WHERE id = 1');
  if (!result.rows.length) return deepClone(baseData);
  const payload = result.rows[0].payload;
  return typeof payload === 'string' ? JSON.parse(payload) : payload;
}

async function getSiteData() {
  if (usePostgres) return getPostgresSiteData();
  return getSqliteSiteData();
}

function saveSqliteSiteData(data) {
  const normalized = normalizeSiteData(data);
  sqliteDb.prepare('UPDATE site_data SET payload = ? WHERE id = 1').run(JSON.stringify(normalized));
  return normalized;
}

async function savePostgresSiteData(data) {
  const normalized = normalizeSiteData(data);
  await postgresPool.query(
    'INSERT INTO site_data (id, payload) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload',
    [normalized]
  );
  return normalized;
}

async function saveSiteData(data) {
  if (usePostgres) return savePostgresSiteData(data);
  return saveSqliteSiteData(data);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  if (usePostgres) {
    const result = await postgresPool.query('SELECT token FROM sessions WHERE token = $1', [token]);
    if (!result.rows.length) return res.status(401).json({ error: 'Sessão inválida' });
    return next();
  }

  const session = sqliteDb.prepare('SELECT token FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Sessão inválida' });
  next();
}

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now(), database: usePostgres ? 'postgres' : 'sqlite' });
});

app.get('/api/site', async (req, res) => {
  res.json(await getSiteData());
});

app.post('/api/login', async (req, res) => {
  const username = normalizeUser(req.body?.username);
  const password = String(req.body?.password || '');

  if (usePostgres) {
    const result = await postgresPool.query('SELECT * FROM admin WHERE id = 1');
    const row = result.rows[0];
    if (!row || row.username !== username || row.password_hash !== hash(password)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    await postgresPool.query('INSERT INTO sessions (token, created_at) VALUES ($1, $2)', [token, Date.now()]);
    return res.json({ token });
  }

  const row = sqliteDb.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!row || row.username !== username || row.password_hash !== hash(password)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  sqliteDb.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
  res.json({ token });
});

app.get('/api/admin/site', authenticate, async (req, res) => {
  res.json(await getSiteData());
});

app.post('/api/admin/site', authenticate, async (req, res) => {
  const payload = req.body || {};
  if (!payload || !payload.profile || !Array.isArray(payload.projects) || !Array.isArray(payload.skills)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const saved = await saveSiteData(payload);
  res.json({ ok: true, data: saved });
});

app.post('/api/admin/account', authenticate, async (req, res) => {
  const username = normalizeUser(req.body?.username || currentAdminUser);
  const password = String(req.body?.password || currentAdminPassword);

  if (usePostgres) {
    await postgresPool.query('UPDATE admin SET username = $1, password_hash = $2 WHERE id = 1', [username, hash(password)]);
    return res.json({ ok: true, username });
  }

  sqliteDb.prepare('UPDATE admin SET username = ?, password_hash = ? WHERE id = 1').run(username, hash(password));
  res.json({ ok: true, username });
});

app.delete('/api/admin/logout', authenticate, async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (usePostgres) {
    await postgresPool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return res.json({ ok: true });
  }

  sqliteDb.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  if (process.env.VERCEL && !DATABASE_URL) {
    throw new Error('DATABASE_URL ausente. Defina um banco PostgreSQL no ambiente da Vercel antes do deploy.');
  }

  await initializeDatabase();
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log(`Banco: ${usePostgres ? 'Postgres/Vercel' : 'SQLite local'}`);
      console.log(`Login: ${currentAdminUser} / ${currentAdminPassword}`);
    });
  }
}

startServer().catch((error) => {
  console.error('Falha ao iniciar banco de dados:', error);
  process.exit(1);
});

module.exports = app;
