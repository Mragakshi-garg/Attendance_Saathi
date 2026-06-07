'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Student Dashboard (student-dashboard.html)
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const chipAvatarLetter = document.getElementById('chip-avatar-letter');
  const chipStudentName = document.getElementById('chip-student-name');
  const profileAvatar = document.getElementById('profile-avatar');
  const avatarLetter = document.getElementById('avatar-letter');
  const profileName = document.getElementById('profile-name');
  const profileBadges = document.getElementById('profile-badges');
  const profileEmailText = document.getElementById('profile-email-text');
  const profileRollText = document.getElementById('profile-roll-text');
  const profileDeptText = document.getElementById('profile-dept-text');
  const statPresent = document.getElementById('stat-present');
  const statAbsent = document.getElementById('stat-absent');
  const statRate = document.getElementById('stat-rate');
  const ringProgress = document.getElementById('ring-progress');
  const ringValue = document.getElementById('ring-value');
  const attendanceTbody = document.getElementById('attendance-tbody');
  const faceCaptureSection = document.getElementById('face-capture-section');
  const capturePreview = document.getElementById('capture-preview');
  const facePlaceholder = document.getElementById('face-placeholder');
  const faceStatusText = document.getElementById('face-status-text');
  const captureFaceBtn = document.getElementById('capture-face-btn');
  const faceVideo = document.getElementById('face-video');
  const faceCanvas = document.getElementById('face-canvas-capture');
  const cameraControlsFace = document.getElementById('camera-controls-face');
  const takePhotoBtn = document.getElementById('take-photo-btn');
  const cancelCameraBtn = document.getElementById('cancel-camera-btn');
  const logoutBtn = document.getElementById('logout-btn');

  let cameraStream = null;

  // ─── Auth Guard ──────────────────────────────────────────────────────────
  async function requireAuth() {
    try {
      const res = await fetch('/api/auth/verify', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      // If the user is not a student, redirect to admin dashboard
      if (data.data && data.data.role && data.data.role !== 'student') {
        window.location.href = 'dashboard.html';
        return;
      }
    } catch (_) {
      window.location.href = 'admin.html';
    }
  }
  requireAuth();

  // ─── Toast Notification ──────────────────────────────────────────────────
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

  // ─── Escape HTML ─────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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
      const eased = 1 - (1 - progress) * (1 - progress);
      element.textContent = Math.round(start + diff * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ─── Get Initials ────────────────────────────────────────────────────────
  function getInitials(name) {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  // ─── Load Profile ────────────────────────────────────────────────────────
  async function loadProfile() {
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = 'admin.html';
          return;
        }
        throw new Error('Failed to load profile');
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const profile = data.data;
      const initials = getInitials(profile.name);

      // Top bar
      chipAvatarLetter.textContent = initials;
      chipStudentName.textContent = profile.name || 'Student';

      // Profile header
      profileName.textContent = profile.name || 'Unknown Student';

      // Avatar
      if (profile.cloudinaryUrl) {
        avatarLetter.style.display = 'none';
        const img = document.createElement('img');
        img.src = profile.cloudinaryUrl;
        img.alt = 'Profile photo';
        profileAvatar.appendChild(img);
      } else {
        avatarLetter.textContent = initials;
      }

      // Badges
      profileBadges.innerHTML = '';
      if (profile.verified) {
        profileBadges.innerHTML += `<span class="verified-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Verified
        </span>`;
      } else {
        profileBadges.innerHTML += `<span class="unverified-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Unverified
        </span>`;
      }

      if (!profile.hasFaceProfile) {
        profileBadges.innerHTML += `<span class="no-face-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          No Face
        </span>`;
      }

      // Meta info
      profileEmailText.textContent = profile.email || '—';
      profileRollText.textContent = profile.rollNumber || '—';
      profileDeptText.textContent = profile.department || '—';

      // Face capture section
      updateFaceSection(profile);

    } catch (err) {
      console.error('[StudentDashboard] Profile error:', err);
      showToast('Failed to load profile data', 'error');
    }
  }
  loadProfile();

  // ─── Update Face Section ─────────────────────────────────────────────────
  function updateFaceSection(profile) {
    if (profile.hasFaceProfile && profile.cloudinaryUrl) {
      // Show the face photo
      capturePreview.innerHTML = `<img src="${escapeHtml(profile.cloudinaryUrl)}" alt="Face profile">`;
      faceStatusText.textContent = 'Face profile registered ✓';
      faceStatusText.style.color = 'var(--success)';
      captureFaceBtn.textContent = 'Update Face';
      captureFaceBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
        Update Face`;
    } else {
      faceStatusText.textContent = 'No face profile registered yet.';
      faceStatusText.style.color = 'var(--text-secondary)';
    }
  }

  // ─── Load Attendance ─────────────────────────────────────────────────────
  async function loadAttendance() {
    try {
      const res = await fetch('/api/profile/attendance', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = 'admin.html';
          return;
        }
        throw new Error('Failed to load attendance');
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const attendance = data.data;
      const records = attendance.records || [];
      const totalPresent = attendance.total_present || 0;
      const totalAbsent = attendance.total_absent || 0;
      const total = totalPresent + totalAbsent;
      const rate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

      // Animate stats
      animateNumber(statPresent, totalPresent);
      animateNumber(statAbsent, totalAbsent);
      animateNumber(statRate, rate, '%');

      // Render donut ring
      renderRing(rate);

      // Render attendance table
      renderAttendanceTable(records);

    } catch (err) {
      console.error('[StudentDashboard] Attendance error:', err);
      attendanceTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 40px;">
            Failed to load attendance data.
          </td>
        </tr>`;
      showToast('Failed to load attendance', 'error');
    }
  }
  loadAttendance();

  // ─── Render SVG Donut Ring ───────────────────────────────────────────────
  function renderRing(percentage) {
    const circumference = 2 * Math.PI * 52; // r = 52
    const offset = circumference - (percentage / 100) * circumference;

    // Animate the ring
    ringProgress.style.transition = 'stroke-dashoffset 1s ease';
    requestAnimationFrame(() => {
      ringProgress.setAttribute('stroke-dashoffset', offset);
    });

    ringValue.textContent = percentage + '%';
  }

  // ─── Render Attendance Table ─────────────────────────────────────────────
  function renderAttendanceTable(records) {
    if (!records || records.length === 0) {
      attendanceTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 40px;">
            No attendance records found.
          </td>
        </tr>`;
      return;
    }

    attendanceTbody.innerHTML = records
      .map((r) => {
        const dateStr = r.date
          ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—';

        const timeStr = r.check_in_time || '—';

        const statusClass =
          r.status === 'Present'
            ? 'success'
            : r.status === 'Late'
            ? 'warning'
            : 'error';

        return `
          <tr>
            <td>${escapeHtml(dateStr)}</td>
            <td>${escapeHtml(timeStr)}</td>
            <td><span class="status-badge ${statusClass}">${escapeHtml(r.status || 'Absent')}</span></td>
          </tr>`;
      })
      .join('');
  }

  // ─── Face Capture ────────────────────────────────────────────────────────
  if (captureFaceBtn) {
    captureFaceBtn.addEventListener('click', startCamera);
  }

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      faceVideo.srcObject = cameraStream;
      faceVideo.style.display = 'block';

      // Show video in the preview circle
      capturePreview.innerHTML = '';
      capturePreview.appendChild(faceVideo);
      faceVideo.style.display = 'block';
      faceVideo.style.width = '100%';
      faceVideo.style.height = '100%';
      faceVideo.style.objectFit = 'cover';

      // Show camera controls, hide capture button
      cameraControlsFace.style.display = 'flex';
      captureFaceBtn.style.display = 'none';
      faceStatusText.textContent = 'Position your face in the circle and click "Take Photo"';
      faceStatusText.style.color = 'var(--text-accent)';
    } catch (err) {
      console.error('[StudentDashboard] Camera error:', err);
      showToast('Unable to access camera. Please allow camera permissions.', 'error');
    }
  }

  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', captureAndUpload);
  }

  async function captureAndUpload() {
    if (!cameraStream) return;

    // Draw frame to canvas
    faceCanvas.width = faceVideo.videoWidth;
    faceCanvas.height = faceVideo.videoHeight;
    const ctx = faceCanvas.getContext('2d');
    ctx.drawImage(faceVideo, 0, 0);

    // Convert to base64
    const base64 = faceCanvas.toDataURL('image/jpeg', 0.85);

    // Stop camera
    stopCamera();

    // Show loading state
    capturePreview.innerHTML = `<div class="loading-spinner"></div>`;
    faceStatusText.textContent = 'Uploading face profile…';
    faceStatusText.style.color = 'var(--text-muted)';
    cameraControlsFace.style.display = 'none';

    try {
      const res = await fetch('/api/profile/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload face');
      }

      showToast('Face profile updated successfully!', 'success');

      // Refresh profile to show updated photo
      loadProfile();
    } catch (err) {
      console.error('[StudentDashboard] Face upload error:', err);
      showToast(err.message || 'Failed to upload face profile', 'error');
      // Reset the preview
      capturePreview.innerHTML = `<div class="placeholder-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>`;
      faceStatusText.textContent = 'Upload failed. Try again.';
      faceStatusText.style.color = 'var(--error)';
      captureFaceBtn.style.display = '';
    }
  }

  if (cancelCameraBtn) {
    cancelCameraBtn.addEventListener('click', () => {
      stopCamera();
      // Restore preview
      capturePreview.innerHTML = `<div class="placeholder-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>`;
      cameraControlsFace.style.display = 'none';
      captureFaceBtn.style.display = '';
      faceStatusText.textContent = 'No face profile registered yet.';
      faceStatusText.style.color = 'var(--text-secondary)';
    });
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    faceVideo.srcObject = null;
    faceVideo.style.display = 'none';
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      localStorage.removeItem('faceattend_token');
      window.location.href = 'index.html';
    });
  }
})();
