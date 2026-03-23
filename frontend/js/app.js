/**
 * app.js
 * Main application controller.
 * Wires together api.js and ui.js — no direct DOM rendering here.
 */

let allStudents  = [];
let editingId    = null;
let deleteId     = null;
let currentPage  = 1;
let searchTimer  = null;

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  bindEvents();
  await Promise.all([loadStats(), loadStudents()]);
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents() {
  // Sidebar / topbar
  document.getElementById('navStudents').addEventListener('click', () => {
    document.getElementById('tableWrap').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('navAdd').addEventListener('click', () => handleOpenModal());
  document.getElementById('btnAddTop').addEventListener('click', () => handleOpenModal());

  // Search & filter
  document.getElementById('searchInput').addEventListener('input', debounceSearch);
  document.getElementById('gradeFilter').addEventListener('change', debounceSearch);

  // Modal
  document.getElementById('modalClose').addEventListener('click',  closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click',   handleSave);
  document.getElementById('studentModal').addEventListener('click', e => {
    if (e.target === document.getElementById('studentModal')) closeModal();
  });

  // Confirm dialog
  document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
  document.getElementById('confirmOk').addEventListener('click',     handleDelete);
  document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirmOverlay')) closeConfirm();
  });

  // Pagination (delegated)
  document.getElementById('tableWrap').addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const page = Number(btn.dataset.page);
    const max  = Math.ceil(allStudents.length / PAGE_SIZE);
    if (page >= 1 && page <= max) {
      currentPage = page;
      renderTable(allStudents, currentPage, handleEdit, handleAskDelete);
    }
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); }
  });
}

// ── Data Loaders ──────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await fetchStats();
    renderStats(data);
  } catch (_) { /* silent */ }
}

async function loadStudents() {
  const search = document.getElementById('searchInput').value;
  const grade  = document.getElementById('gradeFilter').value;

  showTableLoading();
  try {
    allStudents = await fetchStudents(search, grade);
    currentPage = 1;
    renderTable(allStudents, currentPage, handleEdit, handleAskDelete);
  } catch (_) {
    showTableError();
  }
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadStudents();
    loadStats();
  }, 350);
}

// ── Student Handlers ──────────────────────────────────────────────────────────

function handleOpenModal(student = null) {
  editingId = student ? student.id : null;
  openModal(student); // openModal is defined in ui.js
}

async function handleEdit(id) {
  try {
    const student = await fetchStudent(id);
    editingId = id;
    openModal(student); // openModal is defined in ui.js
  } catch (_) {
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
      showToast('Student updated ✓', 'success');
    } else {
      await createStudent(payload);
      showToast('Student added ✓', 'success');
    }
    closeModal();
    editingId = null;
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleAskDelete(id, name) {
  deleteId = id;
  openConfirm(name);
}

async function handleDelete() {
  if (!deleteId) return;
  try {
    await deleteStudent(deleteId);
    showToast('Student deleted', 'success');
    closeConfirm();
    deleteId = null;
    await Promise.all([loadStudents(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
