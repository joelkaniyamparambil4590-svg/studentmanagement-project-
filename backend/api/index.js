const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const pool = require('./db');
const app  = express();

app.use(cors());
app.use(express.json());

// Serve the frontend folder
app.use(express.static(path.join(__dirname, '../../frontend')));

// ── Init DB ──────────────────────────────────────────────────────────────────
async function initDB() {
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
initDB().catch(console.error);

// ── GET all students ─────────────────────────────────────────────────────────
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
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ── GET single student ───────────────────────────────────────────────────────
app.get('/api/students/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// ── POST create student ──────────────────────────────────────────────────────
app.post('/api/students', async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;
  if (!name || !email || !grade)
    return res.status(400).json({ error: 'Name, email and grade are required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO students (name,email,phone,grade,section,age,gender,address,joined_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, email, phone||null, grade, section||null, age||null, gender||null, address||null, joined_on||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// ── PUT update student ───────────────────────────────────────────────────────
app.put('/api/students/:id', async (req, res) => {
  const { name, email, phone, grade, section, age, gender, address, joined_on } = req.body;
  if (!name || !email || !grade)
    return res.status(400).json({ error: 'Name, email and grade are required' });

  try {
    const { rows } = await pool.query(
      `UPDATE students SET name=$1,email=$2,phone=$3,grade=$4,section=$5,
       age=$6,gender=$7,address=$8,joined_on=$9 WHERE id=$10 RETURNING *`,
      [name, email, phone||null, grade, section||null, age||null, gender||null, address||null, joined_on||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// ── DELETE student ───────────────────────────────────────────────────────────
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ── GET stats ────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [total, byGrade] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM students'),
      pool.query('SELECT grade, COUNT(*) as count FROM students GROUP BY grade ORDER BY grade')
    ]);
    res.json({ total: parseInt(total.rows[0].count), byGrade: byGrade.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Fallback → frontend index ─────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));

module.exports = app;
