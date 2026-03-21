# EduTrack — Student Management System

Full-stack student management system with a clean frontend/backend separation.

---

## 📁 Project Structure

```
student-mgmt/
│
├── backend/                   ← Node.js + Express API
│   ├── api/
│   │   ├── index.js           ← Express server & all REST routes
│   │   └── db.js              ← PostgreSQL pool (Neon-compatible)
│   ├── .env.example
│   └── package.json
│
├── frontend/                  ← Static HTML/CSS/JS
│   ├── index.html             ← Single-page markup (no inline JS/CSS)
│   ├── css/
│   │   └── style.css          ← All styles
│   └── js/
│       ├── api.js             ← Fetch wrappers for the backend API
│       ├── ui.js              ← DOM rendering helpers (table, modal, toast…)
│       └── app.js             ← Main controller (events, orchestration)
│
├── vercel.json                ← Vercel deployment config
├── .gitignore
└── README.md
```

---

## 🚀 Local Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Paste your Neon.tech DATABASE_URL inside .env
```

### 3. Run
```bash
npm run dev    # nodemon — auto-restarts on changes
# OR
npm start      # plain node
```

Open → [http://localhost:3000](http://localhost:3000)

> The backend serves the `frontend/` folder as static files automatically.

---

## ☁️ Deploy to Vercel

1. Push the whole project to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Add Environment Variable:
   - **Key**: `DATABASE_URL`
   - **Value**: your Neon connection string
4. Deploy — the `students` table is created automatically on first request

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | List all (`?search=` / `?grade=`) |
| GET | `/api/students/:id` | Single student |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student |
| GET | `/api/stats` | Total + per-grade counts |

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5 · CSS3 · Vanilla JS (3 files) |
| Backend | Node.js · Express.js |
| Database | PostgreSQL via [Neon.tech](https://neon.tech) |
| Hosting | [Vercel](https://vercel.com) |
