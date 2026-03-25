/**
 * ui.js
 * Pure rendering and DOM helpers.
 */

const PAGE_SIZE = 10;

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function renderStats(data) {
  const grid = document.getElementById('statsGrid');
  const gradeCards = data.byGrade.map((gradeRow) => `
    <div class="stat-card">
      <div class="stat-label">${gradeRow.grade}</div>
      <div class="stat-value">${gradeRow.count}</div>
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

function renderTable(students, currentPage, onEdit, onDelete) {
  const wrap = document.getElementById('tableWrap');
  const total = students.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = students.slice(start, start + PAGE_SIZE);

  document.getElementById('countBadge').textContent =
    `${total} student${total !== 1 ? 's' : ''}`;

  if (!total) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">0</div>
        <p>No students found. Try a different search or add one.</p>
      </div>
    `;
    return;
  }

  const rows = slice.map((student) => {
    const initials = student.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
    const avatarClass = 'av-' + ((student.id % 8) + 1);
    const joined = student.joined_on
      ? new Date(student.joined_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

    return `
      <tr>
        <td>
          <div class="student-cell">
            <div class="avatar ${avatarClass}">${initials}</div>
            <div>
              <div class="student-name">${student.name}</div>
              <div class="student-email">${student.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="grade-badge">${student.grade}</span>
          ${student.section ? `<span class="section-badge">${student.section}</span>` : ''}
        </td>
        <td>${student.age || '-'}</td>
        <td>${student.gender || '-'}</td>
        <td>${student.phone || '-'}</td>
        <td>${joined}</td>
        <td>
          <div class="actions">
            <button class="action-btn" data-edit="${student.id}" title="Edit">Edit</button>
            <button class="action-btn del" data-del="${student.id}" data-name="${student.name.replace(/"/g, '&quot;')}" title="Delete">Del</button>
          </div>
        </td>
      </tr>
    `;
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

  wrap.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(Number(button.dataset.edit)));
  });

  wrap.querySelectorAll('[data-del]').forEach((button) => {
    button.addEventListener('click', () => onDelete(Number(button.dataset.del), button.dataset.name));
  });
}

function renderPagination(current, total, count, start) {
  let buttons = `
    <button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}><</button>
  `;

  for (let page = 1; page <= total; page += 1) {
    if (total > 7 && page > 2 && page < total - 1 && Math.abs(page - current) > 1) {
      if (page === 3 || page === total - 2) {
        buttons += '<span style="padding:0 4px;color:var(--muted)">...</span>';
      }
      continue;
    }

    buttons += `<button class="page-btn ${page === current ? 'active' : ''}" data-page="${page}">${page}</button>`;
  }

  buttons += `
    <button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>></button>
  `;

  return `
    <div class="pagination">
      <span>Showing ${start + 1}-${Math.min(start + PAGE_SIZE, count)} of ${count}</span>
      <div class="page-btns">${buttons}</div>
    </div>
  `;
}

function renderUsersTable(users, canManageAdminPrivileges, currentUserId, onToggleAdmin) {
  const wrap = document.getElementById('usersWrap');
  document.getElementById('userCountBadge').textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;

  if (!users.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">0</div>
        <p>No users found.</p>
      </div>
    `;
    return;
  }

  const rows = users.map((user) => {
    const canToggle = canManageAdminPrivileges && user.id !== currentUserId;

    return `
      <tr>
        <td>${user.username}</td>
        <td>
          <span class="role-badge ${user.isAdmin ? 'role-admin' : 'role-user'}">
            ${user.isAdmin ? 'Admin' : 'User'}
          </span>
        </td>
        <td>${new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>
          ${canToggle
            ? `<button class="action-btn" data-user-admin="${user.id}" data-user-next-admin="${String(!user.isAdmin)}">${user.isAdmin ? 'Remove admin' : 'Make admin'}</button>`
            : '<span class="muted-note">Locked</span>'}
        </td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Created</th>
          <th>Admin Access</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-user-admin]').forEach((button) => {
    button.addEventListener('click', () => {
      onToggleAdmin(
        Number(button.dataset.userAdmin),
        button.dataset.userNextAdmin === 'true'
      );
    });
  });
}

function openModal(student = null) {
  const isEdit = Boolean(student);
  document.getElementById('modalTitle').textContent = isEdit ? 'Edit Student' : 'Add New Student';
  document.getElementById('modalSub').textContent = isEdit
    ? `Editing ${student.name}`
    : 'Fill in the student details below';

  const fields = ['name', 'email', 'phone', 'grade', 'section', 'age', 'gender', 'address'];
  fields.forEach((field) => {
    const element = document.getElementById('f_' + field);
    if (element) {
      element.value = isEdit ? (student[field] || '') : '';
    }
  });

  const joinedElement = document.getElementById('f_joined');
  if (joinedElement) {
    joinedElement.value = isEdit && student.joined_on
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
    name: document.getElementById('f_name').value.trim(),
    email: document.getElementById('f_email').value.trim(),
    phone: document.getElementById('f_phone').value.trim(),
    grade: document.getElementById('f_grade').value,
    section: document.getElementById('f_section').value,
    age: document.getElementById('f_age').value || null,
    gender: document.getElementById('f_gender').value,
    joined_on: document.getElementById('f_joined').value || null,
    address: document.getElementById('f_address').value.trim(),
  };
}

function getUserFormData() {
  return {
    username: document.getElementById('u_username').value.trim(),
    password: document.getElementById('u_password').value,
    isAdmin: document.getElementById('u_is_admin').checked,
  };
}

function resetUserForm() {
  document.getElementById('userForm').reset();
}

function configureUserAdminSection(session) {
  const section = document.getElementById('userAdminSection');
  const navUsers = document.getElementById('navUsers');
  const note = document.getElementById('adminNote');
  const checkboxRow = document.getElementById('adminCheckboxRow');
  const checkbox = document.getElementById('u_is_admin');
  const sub = document.getElementById('userAdminSub');

  if (!session.isAdmin) {
    section.classList.add('hidden');
    if (navUsers) {
      navUsers.classList.add('hidden');
    }
    return;
  }

  section.classList.remove('hidden');
  if (navUsers) {
    navUsers.classList.remove('hidden');
  }
  sub.textContent = session.canManageAdminPrivileges
    ? 'Create users and change admin access.'
    : 'Create users. Admin access changes are disabled by environment configuration.';

  checkbox.disabled = !session.canManageAdminPrivileges;
  checkboxRow.classList.toggle('disabled', !session.canManageAdminPrivileges);
  note.textContent = session.canManageAdminPrivileges
    ? 'Admin privileges can be updated because ALLOW_ADMIN_PRIVILEGE_CHANGES=true.'
    : 'Set ALLOW_ADMIN_PRIVILEGE_CHANGES=true to allow admin role changes.';
}

function openConfirm(name) {
  document.getElementById('confirmMsg').textContent = `Delete "${name}"? This action cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

function showTableLoading() {
  document.getElementById('tableWrap').innerHTML =
    '<div class="loading"><div class="spinner"></div> Loading students...</div>';
}

function showTableError(message = 'Failed to load students. Check your connection.') {
  document.getElementById('tableWrap').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <p>${message}</p>
    </div>
  `;
}

function showUsersLoading() {
  const wrap = document.getElementById('usersWrap');
  if (wrap) {
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> Loading users...</div>';
  }
}

function showUsersError(message = 'Failed to load users.') {
  const wrap = document.getElementById('usersWrap');
  if (wrap) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <p>${message}</p>
      </div>
    `;
  }
}
