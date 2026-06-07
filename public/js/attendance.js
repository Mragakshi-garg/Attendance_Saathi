'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Attendance Records Page (attendance.html)
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
  const pageSize = 20;
  let filters = { from: '', to: '', student_id: '', status: '' };

  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const attSearch = document.getElementById('att-search');
  const statusFilter = document.getElementById('status-filter');
  const applyBtn = document.getElementById('apply-filters-btn');
  const resetBtn = document.getElementById('reset-filters-btn');
  const exportBtn = document.getElementById('export-btn');

  const tableWrapper = document.getElementById('attendance-table-wrapper');
  const loadingEl = document.getElementById('attendance-loading');
  const emptyEl = document.getElementById('attendance-empty');
  const tbody = document.getElementById('attendance-tbody');
  const pagination = document.getElementById('att-pagination');

  const summaryTotal = document.getElementById('summary-total');
  const summaryPresent = document.getElementById('summary-present');
  const summaryAbsent = document.getElementById('summary-absent');

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

  // ─── Set Default Dates ───────────────────────────────────────────────────
  function setDefaultDates() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    dateTo.value = today.toISOString().split('T')[0];
    dateFrom.value = sevenDaysAgo.toISOString().split('T')[0];
  }
  setDefaultDates();

  // ─── Load Attendance Records ─────────────────────────────────────────────
  async function loadAttendance() {
    showLoading();

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
      });

      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.student_id) params.set('student_id', filters.student_id);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/attendance?${params.toString()}`, { credentials: 'include' });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = 'admin.html';
          return;
        }
        throw new Error('Failed to load attendance');
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      renderAttendance(data.data.records, data.data.total, data.data.totalPages);
    } catch (err) {
      console.error('[Attendance] Load error:', err);
      showToast('Failed to load attendance records', 'error');
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

  function renderAttendance(records, total, totalPages) {
    loadingEl.classList.add('hidden');

    if (records.length === 0) {
      showEmpty();
      pagination.innerHTML = '';
      summaryTotal.textContent = '0';
      summaryPresent.textContent = '0';
      summaryAbsent.textContent = '0';
      return;
    }

    emptyEl.classList.add('hidden');
    tableWrapper.classList.remove('hidden');

    // Filter by search text on client side
    const searchTerm = attSearch.value.trim().toLowerCase();
    let filtered = records;
    if (searchTerm) {
      filtered = records.filter(
        (r) =>
          (r.student_name && r.student_name.toLowerCase().includes(searchTerm)) ||
          (r.roll_number && r.roll_number.toLowerCase().includes(searchTerm))
      );
    }

    tbody.innerHTML = filtered
      .map((r, i) => {
        const idx = (currentPage - 1) * pageSize + i + 1;

        const statusClass =
          r.status === 'Present'
            ? 'success'
            : r.status === 'Late'
            ? 'warning'
            : 'error';

        const formattedDate = r.date
          ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
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
                <div class="avatar-sm">${escapeHtml((r.student_name || '?')[0])}</div>
                <span>${escapeHtml(r.student_name || '—')}</span>
              </div>
            </td>
            <td><span class="badge">${escapeHtml(r.roll_number || '—')}</span></td>
            <td>${formattedDate}</td>
            <td>${escapeHtml(r.check_in_time || '—')}</td>
            <td>${escapeHtml(r.check_out_time || '—')}</td>
            <td><span class="status-badge ${statusClass}">${escapeHtml(r.status || '—')}</span></td>
          </tr>`;
      })
      .join('');

    // Update summary
    summaryTotal.textContent = total;
    const presentCount = filtered.filter((r) => r.status === 'Present').length;
    const absentCount = filtered.filter((r) => r.status !== 'Present').length;
    summaryPresent.textContent = presentCount;
    summaryAbsent.textContent = absentCount;

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
    html += `<button class="btn-page ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

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

    html += `<button class="btn-page ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;

    pagination.innerHTML = html;

    pagination.querySelectorAll('.btn-page:not(.disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        loadAttendance();
      });
    });
  }

  // ─── Filters ─────────────────────────────────────────────────────────────
  applyBtn.addEventListener('click', () => {
    filters.from = dateFrom.value;
    filters.to = dateTo.value;
    filters.status = statusFilter.value;
    currentPage = 1;
    loadAttendance();
  });

  resetBtn.addEventListener('click', () => {
    setDefaultDates();
    attSearch.value = '';
    statusFilter.value = '';
    filters = { from: '', to: '', student_id: '', status: '' };
    currentPage = 1;
    loadAttendance();
  });

  // Debounced search (client-side filter triggers re-render)
  let searchTimeout;
  attSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadAttendance();
    }, 400);
  });

  // ─── Export CSV ──────────────────────────────────────────────────────────
  exportBtn.addEventListener('click', async () => {
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.student_id) params.set('student_id', filters.student_id);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/attendance/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        showToast('Failed to export CSV', 'error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header if available
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'attendance_export.csv';
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast('CSV exported successfully', 'success');
    } catch (err) {
      console.error('[Attendance] Export error:', err);
      showToast('Failed to export CSV', 'error');
    }
  });

  // ─── Export Excel ────────────────────────────────────────────────────────
  const exportExcelBtn = document.getElementById('export-excel-btn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', async () => {
      try {
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.student_id) params.set('student_id', filters.student_id);
        if (filters.status) params.set('status', filters.status);
        params.set('format', 'xlsx');

        const res = await fetch(`/api/attendance/export?${params.toString()}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          showToast('Failed to export Excel', 'error');
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const disposition = res.headers.get('Content-Disposition');
        let filename = 'attendance_export.xlsx';
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showToast('Excel exported successfully', 'success');
      } catch (err) {
        console.error('[Attendance] Excel export error:', err);
        showToast('Failed to export Excel', 'error');
      }
    });
  }

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
  // Apply default date filters
  filters.from = dateFrom.value;
  filters.to = dateTo.value;
  loadAttendance();
})();
