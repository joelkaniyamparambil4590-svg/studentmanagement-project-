/**
 * api.js
 * Handles all communication with the backend REST API.
 */

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('edu_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(API_BASE + path, {
    headers,
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem('edu_token');
    localStorage.removeItem('edu_username');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Your session has expired. Please sign in again.');
  }

  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Students ────────────────────────────────────────────────────────────────

async function fetchStudents(search = '', grade = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (grade)  params.set('grade',  grade);
  return apiFetch('/students?' + params.toString());
}

async function fetchStudent(id) {
  return apiFetch('/students/' + id);
}

async function createStudent(payload) {
  return apiFetch('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateStudent(id, payload) {
  return apiFetch('/students/' + id, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function deleteStudent(id) {
  return apiFetch('/students/' + id, { method: 'DELETE' });
}

// ── Stats ───────────────────────────────────────────────────────────────────

async function fetchStats() {
  return apiFetch('/stats');
}

async function fetchSession() {
  return apiFetch('/session');
}
