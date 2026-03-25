const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { pool, getDatabaseConfigError } = require('./db');
const {
  authenticateCredentials,
  createToken,
  getAuthConfig,
  requireAuth,
  verifyToken,
} = require('./auth');

const app = express();
const frontendDir = path.join(__dirname, '../../frontend');

app.use(cors());
app.use(express.json());

async function initDB() {
  if (!pool) {
    throw getDatabaseConfigError();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100)  NOT NULL,
      email      VARCHAR(150)  UNIQUE NOT NULL,
      phone      VARCHAR(20),
      grade      VARCHAR(20)   NOT NULL,
      section    VARCHAR(10),
      age        INTEGER,
      gender     VARCHAR(10),
      address    TEXT,
      joined_on  DATE          DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ   DEFAULT NOW()
    );
  `);
}

let dbInitError = null;

const dbReady = initDB().catch((error) => {
  dbInitError = error;
  console.error('Database initialization failed:', error);
});

async function ensureDatabaseReady(_req, res, next) {
  await dbReady;

  if (dbInitError) {
    return res.status(503).json({
      error: dbInitError.message || 'Database is not ready',
    });
  }

  return next();
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
}

app.get('/api/health', async (_req, res) => {
  await dbReady;

  if (dbInitError) {
    return res.status(503).json({
      status: 'error',
      db: 'unavailable',
      message: dbInitError.message,
    });
  }

  try {
    const result = await pool.query('SELECT NOW() AS time');
    return res.json({ status: 'ok', db: 'connected', time: result.rows[0].time });
  } catch (error) {
    return res.status(500).json({ status: 'error', db: 'unavailable', message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};

  if (!authenticateCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = createToken(username);
  return res.json({ token, username });
});

app.get('/api/session', (req, res) => {
  const payload = verifyToken(getTokenFromRequest(req));

  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.json({ username: payload.username });
});

app.get('/api/config', (_req, res) => {
  const authConfig = getAuthConfig();
  res.json({
    authConfigured: Boolean(
      process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      (process.env.AUTH_SECRET || process.env.JWT_SECRET)
    ),
    defaultAdminUsername: authConfig.username,
  });
});

app.use('/api/students', requireAuth);
app.use('/api/stats', requireAuth);
app.use('/api/students', ensureDatabaseReady);
app.use('/api/stats', ensureDatabaseReady);

app.get('/api/students', async (req, res) => {
  try {
    const { search, grade } = req.query;
    let query = 'SELECT * FROM students';
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    if (grade) {
      params.push(grade);
      conditions.push(`grade = $${params.length}`);
    }

    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch student' });
  }
});

app.post('/api/students', async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;

  if (!name || !email || !grade) {
    return res.status(400).json({ error: 'Name, email and grade are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO students (name, email, phone, grade, section, age, gender, address, joined_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, email, phone || null, grade, section || null, age || null, gender || null, address || null, joined_on || null]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Failed to create student' });
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;

  if (!name || !email || !grade) {
    return res.status(400).json({ error: 'Name, email and grade are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE students
       SET name = $1, email = $2, phone = $3, grade = $4, section = $5,
           age = $6, gender = $7, address = $8, joined_on = $9
       WHERE id = $10
       RETURNING *`,
      [name, email, phone || null, grade, section || null, age || null, gender || null, address || null, joined_on || null, req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Failed to update student' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json({ message: 'Student deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const [total, byGrade] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM students'),
      pool.query('SELECT grade, COUNT(*) AS count FROM students GROUP BY grade ORDER BY grade'),
    ]);

    return res.json({
      total: Number.parseInt(total.rows[0].count, 10),
      byGrade: byGrade.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/login', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'login.html'));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use('/images', express.static(path.join(frontendDir, 'images')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.sendFile(path.join(frontendDir, 'index.html'));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
