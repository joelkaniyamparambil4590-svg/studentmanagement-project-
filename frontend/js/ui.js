/**
 * ui.js
 * Pure rendering / DOM helpers. No fetch calls here.
 */

const PAGE_SIZE = 10;

// ── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Stats ────────────────────────────────────────────────────────────────────

function renderStats(data) {
  const grid = document.getElementById('statsGrid');

  const gradeCards = data.byGrade.map(g => `
    <div class="stat-card">
      <div class="stat-label">${g.grade}</div>
      <div class="stat-value">${g.count}</div>
      <div class="stat-badge">Students</div>
    </div>
  `).join('');

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Students</div>
      <div class="stat-value">${data.total}</div>
      <div class="stat-badge">Enrolled</div>
    </div>
    ${gradeCards}
  `;
}

// ── Table ────────────────────────────────────────────────────────────────────

function renderTable(students, currentPage, onEdit, onDelete) {
  const wrap   = document.getElementById('tableWrap');
  const total  = students.length;
  const pages  = Math.ceil(total / PAGE_SIZE);
  const start  = (currentPage - 1) * PAGE_SIZE;
  const slice  = students.slice(start, start + PAGE_SIZE);

  document.getElementById('countBadge').textContent =
    `${total} student${total !== 1 ? 's' : ''}`;

  if (!total) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No students found. Try a different search or add one!</p>
      </div>`;
    return;
  }

  const rows = slice.map(s => {
    const initials   = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avClass    = 'av-' + ((s.id % 8) + 1);
    const joined     = s.joined_on
      ? new Date(s.joined_on).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      : '—';
    const genderIcon  = s.gender === 'Male' ? '♂' : s.gender === 'Female' ? '♀' : '—';
    const genderClass = s.gender === 'Male' ? 'gender-m' : s.gender === 'Female' ? 'gender-f' : '';

    return `
      <tr>
        <td>
          <div class="student-cell">
            <div class="avatar ${avClass}">${initials}</div>
            <div>
              <div class="student-name">${s.name}</div>
              <div class="student-email">${s.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="grade-badge">${s.grade}</span>
          ${s.section ? `<span class="section-badge">${s.section}</span>` : ''}
        </td>
        <td>${s.age || '—'}</td>
        <td class="${genderClass}">${genderIcon} ${s.gender || '—'}</td>
        <td>${s.phone || '—'}</td>
        <td>${joined}</td>
        <td>
          <div class="actions">
            <button class="action-btn" data-edit="${s.id}" title="Edit">✏️</button>
            <button class="action-btn del" data-del="${s.id}" data-name="${s.name.replace(/"/g,'&quot;')}" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Grade / Section</th>
          <th>Age</th>
          <th>Gender</th>
          <th>Phone</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${pages > 1 ? renderPagination(currentPage, pages, total, start) : ''}
  `;

  // Attach row-level events
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => onEdit(Number(btn.dataset.edit)));
  });
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => onDelete(Number(btn.dataset.del), btn.dataset.name));
  });
}

function renderPagination(current, total, count, start) {
  let btns = `
    <button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>‹</button>
  `;

  for (let i = 1; i <= total; i++) {
    if (total > 7 && i > 2 && i < total - 1 && Math.abs(i - current) > 1) {
      if (i === 3 || i === total - 2) {
        btns += `<span style="padding:0 4px;color:var(--muted)">…</span>`;
      }
      continue;
    }
    btns += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  btns += `
    <button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>›</button>
  `;

  return `
    <div class="pagination">
      <span>Showing ${start + 1}–${Math.min(start + PAGE_SIZE, count)} of ${count}</span>
      <div class="page-btns">${btns}</div>
    </div>
  `;
}

// ── Modal ────────────────────────────────────────────────────────────────────

function openModal(student = null) {
  const isEdit = !!student;

  document.getElementById('modalTitle').textContent = isEdit ? 'Edit Student'        : 'Add New Student';
  document.getElementById('modalSub').textContent   = isEdit ? `Editing ${student.name}` : 'Fill in the student details below';

  const fields = ['name', 'email', 'phone', 'grade', 'section', 'age', 'gender', 'address'];
  fields.forEach(f => {
    const el = document.getElementById('f_' + f);
    if (el) el.value = isEdit ? (student[f] || '') : '';
  });

  // Format date properly for <input type="date">
  const joinedEl = document.getElementById('f_joined');
  if (joinedEl) {
    joinedEl.value = isEdit && student.joined_on
      ? student.joined_on.split('T')[0]
      : '';
  }

  document.getElementById('studentModal').classList.add('open');
  document.getElementById('f_name').focus();
}

function closeModal() {
  document.getElementById('studentModal').classList.remove('open');
}

function getFormData() {
  return {
    name:      document.getElementById('f_name').value.trim(),
    email:     document.getElementById('f_email').value.trim(),
    phone:     document.getElementById('f_phone').value.trim(),
    grade:     document.getElementById('f_grade').value,
    section:   document.getElementById('f_section').value,
    age:       document.getElementById('f_age').value    || null,
    gender:    document.getElementById('f_gender').value,
    joined_on: document.getElementById('f_joined').value || null,
    address:   document.getElementById('f_address').value.trim(),
  };
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────

function openConfirm(name) {
  document.getElementById('confirmMsg').textContent =
    `Delete "${name}"? This action cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

// ── Loading ──────────────────────────────────────────────────────────────────

function showTableLoading() {
  document.getElementById('tableWrap').innerHTML =
    '<div class="loading"><div class="spinner"></div> Loading students…</div>';
}

function showTableError() {
  document.getElementById('tableWrap').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p>Failed to load students. Check your connection.</p>
    </div>`;
}
