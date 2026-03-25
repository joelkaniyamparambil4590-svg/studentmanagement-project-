const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { pool, getDatabaseConfigError } = require('./db');
const {
  canManageAdminPrivileges,
  createToken,
  getAuthConfig,
  hashPassword,
  requireAuth,
  verifyPassword,
} = require('./auth');

const app = express();
const frontendDir = path.join(__dirname, '../../frontend');

app.use(cors());
app.use(express.json());

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  };
}

async function initDB() {
  if (!pool) {
    throw getDatabaseConfigError();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.students (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      phone VARCHAR(20),
      grade VARCHAR(20) NOT NULL,
      section VARCHAR(10),
      age INTEGER,
      gender VARCHAR(10),
      address TEXT,
      joined_on DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await syncAdminUser();
}

async function syncAdminUser() {
  const authConfig = getAuthConfig();
  const passwordHash = hashPassword(authConfig.password);

  await pool.query(
    `INSERT INTO public.users (username, password_hash, is_admin)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = TRUE`,
    [authConfig.username, passwordHash]
  );
}

let dbInitialized = false;
let dbReadyPromise = null;

async function ensureDatabaseInitialized() {
  if (dbInitialized) {
    return;
  }

  if (!dbReadyPromise) {
    dbReadyPromise = initDB()
      .then(() => {
        dbInitialized = true;
      })
      .catch((error) => {
        console.error('Database initialization failed:', error);
        throw error;
      })
      .finally(() => {
        if (!dbInitialized) {
          dbReadyPromise = null;
        }
      });
  }

  return dbReadyPromise;
}

async function ensureDatabaseReady(_req, res, next) {
  try {
    await ensureDatabaseInitialized();
  } catch (error) {
    return res.status(503).json({
      error: error.message || 'Database is not ready',
    });
  }

  return next();
}

async function requireAdminUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, created_at FROM public.users WHERE id = $1',
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.currentUser = sanitizeUser(user);
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to verify user access' });
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await ensureDatabaseInitialized();
    const result = await pool.query('SELECT NOW() AS time');

    return res.json({
      status: 'ok',
      db: 'connected',
      time: result.rows[0].time,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      db: 'unavailable',
      message: error.message,
    });
  }
});

app.get('/api/config', (_req, res) => {
  const authConfig = getAuthConfig();

  return res.json({
    authConfigured: Boolean(authConfig.secret),
    defaultAdminUsername: authConfig.username,
    adminPrivilegeChangesEnabled: canManageAdminPrivileges(),
  });
});

app.post('/api/login', ensureDatabaseReady, async (req, res) => {
  const { username = '', password = '' } = req.body || {};

  if (!username.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username.trim()]
    );

    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createToken(user);
    return res.json({
      token,
      username: user.username,
      isAdmin: Boolean(user.is_admin),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/session', requireAuth, ensureDatabaseReady, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, created_at FROM public.users WHERE id = $1',
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
      ...sanitizeUser(user),
      canManageAdminPrivileges: canManageAdminPrivileges(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load session' });
  }
});

app.use('/api/students', requireAuth, ensureDatabaseReady);
app.use('/api/stats', requireAuth, ensureDatabaseReady);
app.use('/api/users', requireAuth, ensureDatabaseReady);

app.get('/api/users', requireAdminUser, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, created_at FROM public.users ORDER BY username ASC'
    );

    return res.json({
      users: rows.map(sanitizeUser),
      adminPrivilegeChangesEnabled: canManageAdminPrivileges(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', requireAdminUser, async (req, res) => {
  const {
    username = '',
    password = '',
    isAdmin = false,
  } = req.body || {};

  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  if (isAdmin && !canManageAdminPrivileges()) {
    return res.status(403).json({
      error: 'Admin privileges can only be changed when ALLOW_ADMIN_PRIVILEGE_CHANGES=true',
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.users (username, password_hash, is_admin)
       VALUES ($1, $2, $3)
       RETURNING id, username, is_admin, created_at`,
      [trimmedUsername, hashPassword(password), Boolean(isAdmin)]
    );

    return res.status(201).json(sanitizeUser(rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

app.patch('/api/users/:id/admin', requireAdminUser, async (req, res) => {
  if (!canManageAdminPrivileges()) {
    return res.status(403).json({
      error: 'Admin privileges can only be changed when ALLOW_ADMIN_PRIVILEGE_CHANGES=true',
    });
  }

  const { isAdmin } = req.body || {};
  if (typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'isAdmin must be true or false' });
  }

  if (Number(req.params.id) === req.user.id && !isAdmin) {
    return res.status(400).json({ error: 'You cannot remove your own admin access' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET is_admin = $1
       WHERE id = $2
       RETURNING id, username, is_admin, created_at`,
      [isAdmin, req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(sanitizeUser(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update user privileges' });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const { search, grade } = req.query;
    let query = 'SELECT * FROM public.students';
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
    const { rows } = await pool.query('SELECT * FROM public.students WHERE id = $1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch student' });
  }
});

app.post('/api/students', requireAdminUser, async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;

  if (!name || !email || !grade) {
    return res.status(400).json({ error: 'Name, email and grade are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.students (name, email, phone, grade, section, age, gender, address, joined_on)
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

app.put('/api/students/:id', requireAdminUser, async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;

  if (!name || !email || !grade) {
    return res.status(400).json({ error: 'Name, email and grade are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.students
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

app.delete('/api/students/:id', requireAdminUser, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM public.students WHERE id = $1', [req.params.id]);
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
      pool.query('SELECT COUNT(*) FROM public.students'),
      pool.query('SELECT grade, COUNT(*) AS count FROM public.students GROUP BY grade ORDER BY grade'),
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

ensureDatabaseInitialized().catch(() => {});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
