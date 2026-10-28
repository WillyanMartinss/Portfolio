const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
let DatabaseSync = null;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  console.warn('node:sqlite indisponível neste ambiente; usando fallback em arquivo JSON.', error.message);
}
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
const STORAGE_ROOT = process.env.VERCEL ? '/tmp' : __dirname;
const DB_PATH = path.join(STORAGE_ROOT, 'portfolio.db');
const DATA_FILE_PATH = path.join(STORAGE_ROOT, 'portfolio-data.json');
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
let usePostgres = Boolean(DATABASE_URL);
const SESSION_SECRET = process.env.SESSION_SECRET || 'portfolio-secret-change-me';
const PUBLIC_PORTFOLIO_ONLY = process.env.PUBLIC_PORTFOLIO_ONLY !== 'false';

const baseData = {
  profile: {
    name: 'Willyan Martins',
    title: 'Desenvolvedor Full Stack',
    bio: 'Programador focado em criar soluções digitais práticas, funcionais e com boa experiência para usuários e negócios.',
    email: 'willyanmartins.dev@gmail.com',
    phone: '(11) 99999-9999',
    city: 'São Paulo, SP',
    github: 'https://github.com/WillyanMartinss',
    linkedin: 'https://www.linkedin.com/in/willyan-martins'
  },
  skills: [
    { icon: '⚙️', title: 'Frontend', text: 'Interfaces responsivas, modernas e pensadas para performance e usabilidade.' },
    { icon: '🧠', title: 'UX/UI', text: 'Experiências com foco em clareza visual, navegação fluida e boa conversão.' },
    { icon: '💻', title: 'Backend', text: 'APIs, integrações, autenticação e lógica para aplicações robustas.' },
    { icon: '📦', title: 'Produtos', text: 'Transformo ideias em soluções úteis, escaláveis e com foco em resultado.' }
  ],
  projects: [
    {
      title: 'MiniERP',
      description: 'Sistema de gestão com foco em organização interna, controle de processos e acompanhamento de operações.',
      url: 'https://github.com/WillyanMartinss/MiniERP',
      repo: 'https://github.com/WillyanMartinss/MiniERP',
      image: '',
      tags: ['ERP', 'Gestão', 'Dashboard']
    },
    {
      title: 'Portfolio',
      description: 'Portfólio pessoal para apresentar projetos, perfil profissional e links de contato em uma interface moderna.',
      url: 'https://github.com/WillyanMartinss/Portfolio',
      repo: 'https://github.com/WillyanMartinss/Portfolio',
      image: '',
      tags: ['Portfolio', 'Frontend', 'Web']
    },
    {
      title: 'Whatsapp-Eletron',
      description: 'Projeto com foco em automação e integração de comunicação, pensado para fluxos práticos e dinâmicos.',
      url: 'https://github.com/WillyanMartinss/Whatsapp-Eletron',
      repo: 'https://github.com/WillyanMartinss/Whatsapp-Eletron',
      image: '',
      tags: ['WhatsApp', 'Automação', 'Integração']
    },
    {
      title: 'WYSHUB',
      description: 'Projeto com estrutura voltada para plataforma e centralização de recursos, com foco em experiência e funcionalidade.',
      url: 'https://github.com/WillyanMartinss/WYSHUB',
      repo: 'https://github.com/WillyanMartinss/WYSHUB',
      image: '',
      tags: ['Plataforma', 'Sistema', 'Product']
    }
  ],
  resume: {
    text: 'Desenvolvedor com foco em soluções digitais, automações, gestão e interfaces modernas. Meu trabalho combina funcionalidade, organização e boa experiência para usuário.',
    link: 'https://github.com/WillyanMartinss'
  }
};

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const normalizeUser = (value) => String(value || '').trim();
const currentAdminUser = normalizeUser(process.env.ADMIN_USER || 'admin');
const currentAdminPassword = process.env.ADMIN_PASS || 'troque-por-uma-senha-forte';

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

function readFileJsonStorage() {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(baseData, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    return JSON.parse(raw || JSON.stringify(baseData));
  } catch (error) {
    console.warn('Erro ao ler armazenamento em arquivo JSON. Usando dados padrão.', error.message);
    return deepClone(baseData);
  }
}

function writeFileJsonStorage(payload) {
  try {
    const normalized = normalizeSiteData(payload);
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (error) {
    console.warn('Erro ao gravar armazenamento em arquivo JSON.', error.message);
    return normalizeSiteData(payload);
  }
}

function getFileAdminState() {
  const adminFile = DATA_FILE_PATH + '.admin.json';
  try {
    if (!fs.existsSync(adminFile)) {
      const defaultState = { username: currentAdminUser, password_hash: hash(currentAdminPassword) };
      fs.writeFileSync(adminFile, JSON.stringify(defaultState, null, 2), 'utf8');
      return defaultState;
    }
    return JSON.parse(fs.readFileSync(adminFile, 'utf8'));
  } catch (error) {
    console.warn('Erro ao ler admin do armazenamento em arquivo.', error.message);
    return { username: currentAdminUser, password_hash: hash(currentAdminPassword) };
  }
}

function setFileAdminState(nextState) {
  const adminFile = DATA_FILE_PATH + '.admin.json';
  const safeState = {
    username: normalizeUser(nextState?.username || currentAdminUser),
    password_hash: hash(String(nextState?.password || currentAdminPassword))
  };
  fs.writeFileSync(adminFile, JSON.stringify(safeState, null, 2), 'utf8');
  return safeState;
}

function getFileSessions() {
  const sessionsFile = DATA_FILE_PATH + '.sessions.json';
  try {
    if (!fs.existsSync(sessionsFile)) {
      fs.writeFileSync(sessionsFile, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(sessionsFile, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    console.warn('Erro ao ler sessões do armazenamento em arquivo.', error.message);
    return [];
  }
}

function persistFileSessions(sessions) {
  const sessionsFile = DATA_FILE_PATH + '.sessions.json';
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
}

function initializeSqliteDatabase() {
  if (!DatabaseSync) {
    const fileData = readFileJsonStorage();
    const adminRecord = { username: currentAdminUser, password_hash: hash(currentAdminPassword) };
    if (!fs.existsSync(DATA_FILE_PATH + '.admin.json')) {
      fs.writeFileSync(DATA_FILE_PATH + '.admin.json', JSON.stringify(adminRecord, null, 2), 'utf8');
    }
    return { payload: fileData };
  }

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
  if (!DATABASE_URL) {
    console.warn('DATABASE_URL ausente. Usando SQLite local como fallback no Vercel.');
    usePostgres = false;
    return initializeSqliteDatabase();
  }

  try {
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

    usePostgres = true;
    return postgresPool;
  } catch (error) {
    console.error('Falha ao conectar com Postgres. Fallback para SQLite local.', error);
    usePostgres = false;
    return initializeSqliteDatabase();
  }
}

async function initializeDatabase() {
  if (usePostgres) {
    return initializePostgresDatabase();
  }
  return initializeSqliteDatabase();
}

function getSqliteSiteData() {
  if (!sqliteDb) {
    return readFileJsonStorage();
  }

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
  if (!sqliteDb) {
    return writeFileJsonStorage(normalized);
  }

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
  if (PUBLIC_PORTFOLIO_ONLY) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  if (usePostgres) {
    const result = await postgresPool.query('SELECT token FROM sessions WHERE token = $1', [token]);
    if (!result.rows.length) return res.status(401).json({ error: 'Sessão inválida' });
    return next();
  }

  if (!sqliteDb) {
    const session = getFileSessions().find((entry) => entry.token === token);
    if (!session) return res.status(401).json({ error: 'Sessão inválida' });
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

  if (!sqliteDb) {
    const row = getFileAdminState();
    if (!row || row.username !== username || row.password_hash !== hash(password)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sessions = getFileSessions();
    sessions.push({ token, created_at: Date.now() });
    persistFileSessions(sessions);
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

  if (!sqliteDb) {
    setFileAdminState({ username, password });
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

  if (!sqliteDb) {
    const sessions = getFileSessions().filter((entry) => entry.token !== token);
    persistFileSessions(sessions);
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
    console.warn('DATABASE_URL ausente no ambiente Vercel; iniciando em modo fallback SQLite para manter o site online.');
  }

  await initializeDatabase();
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log(`Banco: ${usePostgres ? 'Postgres/Vercel' : 'SQLite local'}`);
      console.log(`Login: ${currentAdminUser} (senha configurada via ADMIN_PASS no ambiente)`);
    });
  }
}

startServer().catch((error) => {
  console.error('Falha ao iniciar banco de dados:', error);
  process.exit(1);
});

module.exports = app;
