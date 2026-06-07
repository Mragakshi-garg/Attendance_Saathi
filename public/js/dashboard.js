'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Dashboard Page (dashboard.html)
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

  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const statTotal = document.getElementById('stat-total');
  const statPresent = document.getElementById('stat-present');
  const statAbsent = document.getElementById('stat-absent');
  const statRate = document.getElementById('stat-rate');
  const currentDate = document.getElementById('current-date');
  const activityList = document.getElementById('activity-list');
  const logoutBtn = document.getElementById('nav-logout');

  // ─── Sidebar Toggle (Mobile) ─────────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

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

  // ─── Set Current Date ────────────────────────────────────────────────────
  if (currentDate) {
    const now = new Date();
    currentDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  // ─── Animate Number ──────────────────────────────────────────────────────
  function animateNumber(element, target, suffix = '') {
    const duration = 800;
    const start = parseInt(element.textContent) || 0;
    const diff = target - start;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      element.textContent = Math.round(start + diff * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ─── Load Dashboard Stats ───────────────────────────────────────────────
  let trendChart = null;

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = 'admin.html';
          return;
        }
        throw new Error('Failed to load stats');
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const stats = data.data;

      // Animate stat counters
      animateNumber(statTotal, stats.total_students);
      animateNumber(statPresent, stats.today_present);
      animateNumber(statAbsent, stats.today_absent);

      const rate = stats.attendance_rate != null
        ? Math.round(stats.attendance_rate)
        : stats.total_students > 0
          ? Math.round((stats.today_present / stats.total_students) * 100)
          : 0;
      animateNumber(statRate, rate, '%');

      // Render weekly trend chart
      renderTrendChart(stats.weekly_trend || []);
    } catch (err) {
      console.error('[Dashboard] Stats error:', err);
      showToast('Failed to load dashboard data', 'error');
    }
  }
  loadStats();

  // ─── Render Chart.js Trend Chart ─────────────────────────────────────────
  function renderTrendChart(trend) {
    const chartCanvas = document.getElementById('trend-chart');
    if (!chartCanvas || typeof Chart === 'undefined') return;

    const labels = trend.map((t) => {
      const d = new Date(t.date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    const values = trend.map((t) => t.count);

    if (trendChart) trendChart.destroy();

    const gradient = chartCanvas.getContext('2d').createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

    trendChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Students Present',
            data: values,
            borderColor: '#8b5cf6',
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#1a1a2e',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            titleColor: '#e0e0e0',
            bodyColor: '#a0a0b8',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: 'Inter', size: 13, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#7a7a8e', font: { family: 'Inter', size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#7a7a8e',
              font: { family: 'Inter', size: 11 },
              stepSize: 1,
              precision: 0,
            },
          },
        },
      },
    });
  }

  // ─── Load Recent Activity ───────────────────────────────────────────────
  async function loadActivity() {
    try {
      const res = await fetch('/api/admin/recent-activity', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load activity');

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      renderActivity(data.data || []);
    } catch (err) {
      console.error('[Dashboard] Activity error:', err);
      activityList.innerHTML =
        '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Failed to load activity.</div>';
    }
  }
  loadActivity();

  function renderActivity(records) {
    if (records.length === 0) {
      activityList.innerHTML =
        '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No recent activity.</div>';
      return;
    }

    activityList.innerHTML = records
      .map((r) => {
        const statusClass = r.status === 'Present' ? 'green' : r.status === 'Late' ? 'amber' : 'red';
        const statusIcon =
          r.status === 'Present'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

        return `
          <div class="activity-item">
            <div class="activity-dot ${statusClass}"></div>
            <div class="activity-info">
              <div class="activity-name">${escapeHtml(r.student_name)}</div>
              <div class="activity-detail">${r.roll_number || ''} · ${r.department || ''} · ${r.check_in_time || ''}</div>
            </div>
            <div class="activity-badge ${statusClass}">${r.status}</div>
          </div>`;
      })
      .join('');
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

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
