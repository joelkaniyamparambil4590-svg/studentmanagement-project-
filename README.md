# EduTrack - Student Management System

Student management app with:

- `backend/` for the Express + PostgreSQL API
- `frontend/` for the static HTML/CSS/JS dashboard and login page
- `vercel.json` for Vercel routing between static assets and the API

## Project Structure

```text
student-mgmt-v2/
|-- backend/
|   |-- api/
|   |   |-- auth.js
|   |   |-- db.js
|   |   `-- index.js
|   |-- .env.example
|   `-- package.json
|-- frontend/
|   |-- css/
|   |   `-- style.css
|   |-- js/
|   |   |-- api.js
|   |   |-- app.js
|   |   `-- ui.js
|   |-- index.html
|   `-- login.html
|-- .gitignore
|-- README.md
`-- vercel.json
```

## Local Setup

1. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create `backend/.env` from `backend/.env.example`.

3. Add your Neon connection string and auth values:

   ```env
   DATABASE_URL=postgresql://...
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-password
   AUTH_SECRET=your-long-random-secret
   ALLOW_ADMIN_PRIVILEGE_CHANGES=false
   PORT=3000
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000/login`.

## Vercel + Neon

Add these environment variables in Vercel:

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `ALLOW_ADMIN_PRIVILEGE_CHANGES`

Routing behavior:

- `/api/*` -> Express API in `backend/api/index.js`
- `/login` -> `frontend/login.html`
- `/` -> protected dashboard served by the backend

## API Endpoints

- `POST /api/login`
- `GET /api/session`
- `GET /api/health`
- `GET /api/students`
- `GET /api/students/:id`
- `POST /api/students`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`
- `GET /api/stats`
