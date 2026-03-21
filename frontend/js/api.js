/**
 * api.js
 * Handles all communication with the backend REST API.
 */

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();
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
