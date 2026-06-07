'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Student Management Page (students.html)
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── Auth Guard ──────────────────────────────────────────────────────────
  async function requireAuth() {
    try {
      const res = await fetch('/api/auth/verify', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      const authData = await res.json();
      const role = authData.data && authData.data.role;
      if (role === 'student') {
        window.location.href = 'student-dashboard.html';
        return;
      }
    } catch (_) {
      window.location.href = 'admin.html';
    }
  }
  requireAuth();

  // ─── State ────────────────────────────────────────────────────────────────
  let currentPage = 1;
  const pageSize = 10;
  let searchQuery = '';
  let deptFilter = '';
  let editingId = null;
  let modalCameraStream = null;
  let capturedEncoding = null;
  let capturedPhoto = null;

  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const searchInput = document.getElementById('student-search');
  const deptSelect = document.getElementById('dept-filter');
  const tableWrapper = document.getElementById('students-table-wrapper');
  const loadingEl = document.getElementById('students-loading');
  const emptyEl = document.getElementById('students-empty');
  const tbody = document.getElementById('students-tbody');
  const pagination = document.getElementById('students-pagination');
  const addBtn = document.getElementById('add-student-btn');

  // Modal elements
  const modal = document.getElementById('student-modal');
  const modalTitle = document.getElementById('student-modal-title');
  const modalClose = document.getElementById('student-modal-close');
  const modalCancel = document.getElementById('student-modal-cancel');
  const studentForm = document.getElementById('student-form');
  const studentIdInput = document.getElementById('student-id');
  const studentNameInput = document.getElementById('student-name');
  const studentRollInput = document.getElementById('student-roll');
  const studentEmailInput = document.getElementById('student-email');
  const studentDeptInput = document.getElementById('student-dept');
  const studentEncodingInput = document.getElementById('student-encoding');
  const captureStatus = document.getElementById('capture-status');
  const modalCameraPreview = document.getElementById('modal-camera-preview');
  const modalCameraStartBtn = document.getElementById('modal-camera-start');
  const modalCaptureBtn = document.getElementById('modal-capture-btn');

  // Delete modal elements
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalClose = document.getElementById('delete-modal-close');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
  const deleteStudentIdInput = document.getElementById('delete-student-id');

  // Sidebar
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const logoutBtn = document.getElementById('nav-logout');

  // ─── Sidebar Toggle ─────────────────────────────────────────────────────
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarBackdrop.classList.toggle('open');
    });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('open');
    });
  }

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ─── HTML Escape ──────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Load Students ───────────────────────────────────────────────────────
  async function loadStudents() {
    showLoading();

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
      });
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/students?${params.toString()}`, { credentials: 'include' });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = 'admin.html';
          return;
        }
        throw new Error('Failed to load students');
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      let students = data.data.students;

      // Client-side department filter (since server doesn't have this filter)
      if (deptFilter) {
        students = students.filter(
          (s) => s.department && s.department.toLowerCase() === deptFilter.toLowerCase()
        );
      }

      renderStudents(students, data.data.total, data.data.totalPages);
    } catch (err) {
      console.error('[Students] Load error:', err);
      showToast('Failed to load students', 'error');
      showEmpty();
    }
  }

  function showLoading() {
    loadingEl.classList.remove('hidden');
    tableWrapper.classList.add('hidden');
    emptyEl.classList.add('hidden');
  }

  function showEmpty() {
    loadingEl.classList.add('hidden');
    tableWrapper.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }

  function renderStudents(students, total, totalPages) {
    loadingEl.classList.add('hidden');

    if (students.length === 0) {
      showEmpty();
      pagination.innerHTML = '';
      return;
    }

    emptyEl.classList.add('hidden');
    tableWrapper.classList.remove('hidden');

    tbody.innerHTML = students
      .map((s, i) => {
        const idx = (currentPage - 1) * pageSize + i + 1;
        const registered = s.created_at
          ? new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—';

        return `
          <tr>
            <td>${idx}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="avatar-sm">${escapeHtml((s.name || '?')[0])}</div>
                <span>${escapeHtml(s.name)}</span>
              </div>
            </td>
            <td><span class="badge">${escapeHtml(s.roll_number || '—')}</span></td>
            <td>${escapeHtml(s.email || '—')}</td>
            <td><span class="badge dept">${escapeHtml(s.department || '—')}</span></td>
            <td>${s.verified ? '<span class="badge verified" style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px;">✓ Verified</span>' : '<span class="badge unverified" style="background: rgba(239,68,68,0.10); color: #ef4444; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px;">Unverified</span>'}</td>
            <td>${registered}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon edit-btn" data-id="${s.id}" title="Edit Student">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon delete-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Delete Student">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join('');

    // Attach action button listeners
    tbody.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name));
    });

    // Render pagination
    renderPagination(totalPages);
  }

  // ─── Pagination ──────────────────────────────────────────────────────────
  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let html = '';

    // Previous
    html += `<button class="btn-page ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      html += `<button class="btn-page" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="page-dots">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="page-dots">…</span>`;
      html += `<button class="btn-page" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next
    html += `<button class="btn-page ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;

    pagination.innerHTML = html;

    pagination.querySelectorAll('.btn-page:not(.disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        loadStudents();
      });
    });
  }

  // ─── Search & Filter ─────────────────────────────────────────────────────
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      currentPage = 1;
      loadStudents();
    }, 400);
  });

  deptSelect.addEventListener('change', () => {
    deptFilter = deptSelect.value;
    currentPage = 1;
    loadStudents();
  });

  // ─── Add Student Modal ───────────────────────────────────────────────────
  addBtn.addEventListener('click', () => openAddModal());

  function openAddModal() {
    editingId = null;
    capturedEncoding = null;
    capturedPhoto = null;
    modalTitle.textContent = 'Add Student';
    studentForm.reset();
    studentIdInput.value = '';
    studentEncodingInput.value = '';
    captureStatus.textContent = 'No face captured yet';
    captureStatus.style.color = 'var(--text-muted)';
    modal.classList.add('open');
  }

  function openEditModal(id) {
    editingId = id;
    capturedEncoding = null;
    capturedPhoto = null;
    modalTitle.textContent = 'Edit Student';
    captureStatus.textContent = 'Existing face data will be kept if not re-captured';
    captureStatus.style.color = 'var(--text-muted)';

    // Fetch student data
    fetch(`/api/students/${id}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const s = data.data;
          studentIdInput.value = s.id;
          studentNameInput.value = s.name || '';
          studentRollInput.value = s.roll_number || '';
          studentEmailInput.value = s.email || '';
          studentDeptInput.value = s.department || '';
          modal.classList.add('open');
        } else {
          showToast('Failed to load student data', 'error');
        }
      })
      .catch(() => showToast('Failed to load student data', 'error'));
  }

  function closeStudentModal() {
    modal.classList.remove('open');
    stopModalCamera();
    editingId = null;
  }

  modalClose.addEventListener('click', closeStudentModal);
  modalCancel.addEventListener('click', closeStudentModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeStudentModal();
  });

  // ─── Modal Camera ────────────────────────────────────────────────────────
  modalCameraStartBtn.addEventListener('click', async () => {
    try {
      modalCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      });
      modalCameraPreview.srcObject = modalCameraStream;
      await modalCameraPreview.play();
      modalCaptureBtn.disabled = false;
      captureStatus.textContent = 'Camera ready — position your face and capture';
      captureStatus.style.color = 'var(--text-accent)';
    } catch (err) {
      console.error('[Students] Camera error:', err);
      showToast('Camera access denied', 'error');
    }
  });

  modalCaptureBtn.addEventListener('click', async () => {
    if (!modalCameraStream) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = modalCameraPreview.videoWidth;
    tempCanvas.height = modalCameraPreview.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(modalCameraPreview, 0, 0);
    const photoBase64 = tempCanvas.toDataURL('image/jpeg', 0.8);
    capturedPhoto = photoBase64;

    // Send to Python service for encoding
    try {
      captureStatus.textContent = 'Processing face…';
      captureStatus.style.color = 'var(--warning)';

      const blob = await (await fetch(photoBase64)).blob();
      const formData = new FormData();
      formData.append('photo', blob, 'face.jpg');

      const res = await fetch('http://localhost:5001/encode', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Encoding failed');

      const data = await res.json();
      if (data.encoding) {
        capturedEncoding = data.encoding;
        // Store encoding as JSON array for the API
        studentEncodingInput.value = JSON.stringify(data.encoding);
        captureStatus.textContent = '✓ Face captured and encoded successfully';
        captureStatus.style.color = 'var(--success)';
        showToast('Face captured successfully', 'success');
      } else {
        captureStatus.textContent = '✗ No face detected — try again';
        captureStatus.style.color = 'var(--error)';
        showToast('No face detected in the image', 'error');
      }
    } catch (err) {
      console.error('[Students] Encode error:', err);
      captureStatus.textContent = '✗ Failed to process face';
      captureStatus.style.color = 'var(--error)';
      showToast('Face processing failed. Is the Python service running?', 'error');
    }
  });

  function stopModalCamera() {
    if (modalCameraStream) {
      modalCameraStream.getTracks().forEach((t) => t.stop());
      modalCameraStream = null;
    }
    if (modalCameraPreview) {
      modalCameraPreview.srcObject = null;
    }
    modalCaptureBtn.disabled = true;
  }

  // ─── Save Student (Create / Update) ──────────────────────────────────────
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: studentNameInput.value.trim(),
      roll_number: studentRollInput.value.trim(),
      email: studentEmailInput.value.trim(),
      department: studentDeptInput.value,
    };

    if (capturedEncoding) {
      payload.encoding = capturedEncoding; // Send as JSON array
    }
    if (capturedPhoto) {
      payload.photo = capturedPhoto;
    }

    const isEdit = editingId !== null;
    const url = isEdit ? `/api/students/${editingId}` : '/api/students';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to save student', 'error');
        return;
      }

      showToast(
        isEdit ? 'Student updated successfully' : 'Student registered successfully',
        'success'
      );
      closeStudentModal();
      loadStudents();
    } catch (err) {
      console.error('[Students] Save error:', err);
      showToast('Failed to save student', 'error');
    }
  });

  // ─── Delete Student ──────────────────────────────────────────────────────
  function openDeleteModal(id, name) {
    deleteStudentIdInput.value = id;
    deleteModal.querySelector('p').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone and will remove all associated attendance records.`;
    deleteModal.classList.add('open');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('open');
  }

  deleteModalClose.addEventListener('click', closeDeleteModal);
  deleteCancelBtn.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  deleteConfirmBtn.addEventListener('click', async () => {
    const id = deleteStudentIdInput.value;
    if (!id) return;

    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to delete student', 'error');
        return;
      }

      showToast('Student deleted successfully', 'success');
      closeDeleteModal();
      loadStudents();
    } catch (err) {
      console.error('[Students] Delete error:', err);
      showToast('Failed to delete student', 'error');
    }
  });

  // ─── Logout ──────────────────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      localStorage.removeItem('faceattend_token');
      window.location.href = 'admin.html';
    });
  }

  // ─── Initial Load ────────────────────────────────────────────────────────
  loadStudents();
})();
