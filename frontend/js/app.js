/**
 * app.js
 * Main application controller.
 * Wires together api.js and ui.js with auth/session handling.
 */

let allStudents = [];
let editingId = null;
let deleteId = null;
let currentPage = 1;
let searchTimer = null;

async function init() {
  if (!localStorage.getItem('edu_token')) {
    window.location.href = '/login';
    return;
  }

  try {
    const session = await fetchSession();
    updateSessionUI(session.username);
  } catch (_error) {
    return;
  }

  bindEvents();
  await Promise.all([loadStats(), loadStudents()]);
}

function updateSessionUI(username) {
  const userChip = document.getElementById('userChip');
  if (userChip) {
    userChip.textContent = username || localStorage.getItem('edu_username') || 'Admin';
  }
}

function bindEvents() {
  document.getElementById('navStudents').addEventListener('click', () => {
    document.getElementById('tableWrap').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('navAdd').addEventListener('click', () => handleOpenModal());
  document.getElementById('btnAddTop').addEventListener('click', () => handleOpenModal());
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  document.getElementById('searchInput').addEventListener('input', debounceSearch);
  document.getElementById('gradeFilter').addEventListener('change', debounceSearch);

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', handleSave);
  document.getElementById('studentModal').addEventListener('click', (event) => {
    if (event.target === document.getElementById('studentModal')) {
      closeModal();
    }
  });

  document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
  document.getElementById('confirmOk').addEventListener('click', handleDelete);
  document.getElementById('confirmOverlay').addEventListener('click', (event) => {
    if (event.target === document.getElementById('confirmOverlay')) {
      closeConfirm();
    }
  });

  document.getElementById('tableWrap').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) {
      return;
    }

    const page = Number(button.dataset.page);
    const maxPage = Math.ceil(allStudents.length / PAGE_SIZE);
    if (page >= 1 && page <= maxPage) {
      currentPage = page;
      renderTable(allStudents, currentPage, handleEdit, handleAskDelete);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeConfirm();
    }
  });
}

async function loadStats() {
  try {
    const data = await fetchStats();
    renderStats(data);
  } catch (error) {
    showToast(error.message || 'Failed to load stats', 'error');
  }
}

async function loadStudents() {
  const search = document.getElementById('searchInput').value;
  const grade = document.getElementById('gradeFilter').value;

  showTableLoading();

  try {
    allStudents = await fetchStudents(search, grade);
    currentPage = 1;
    renderTable(allStudents, currentPage, handleEdit, handleAskDelete);
  } catch (error) {
    showTableError(error.message || 'Failed to load students. Check your connection.');
  }
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadStudents();
    loadStats();
  }, 350);
}

function handleOpenModal(student = null) {
  editingId = student ? student.id : null;
  openModal(student);
}

async function handleEdit(id) {
  try {
    const student = await fetchStudent(id);
    editingId = id;
    openModal(student);
  } catch (_error) {
    showToast('Failed to load student', 'error');
  }
}

async function handleSave() {
  const payload = getFormData();

  if (!payload.name || !payload.email || !payload.grade) {
    showToast('Name, email and grade are required', 'error');
    return;
  }

  try {
    if (editingId) {
      await updateStudent(editingId, payload);
      showToast('Student updated successfully', 'success');
    } else {
      await createStudent(payload);
      showToast('Student added successfully', 'success');
    }

    closeModal();
    editingId = null;
    await Promise.all([loadStudents(), loadStats()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleAskDelete(id, name) {
  deleteId = id;
  openConfirm(name);
}

async function handleDelete() {
  if (!deleteId) {
    return;
  }

  try {
    await deleteStudent(deleteId);
    showToast('Student deleted', 'success');
    closeConfirm();
    deleteId = null;
    await Promise.all([loadStudents(), loadStats()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('edu_token');
  localStorage.removeItem('edu_username');
  window.location.href = '/login';
}

init();
