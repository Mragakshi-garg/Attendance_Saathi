'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Admin Login Page
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginLoading = document.getElementById('login-loading');
  const loginError = document.getElementById('login-error');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const eyeIcon = document.getElementById('eye-icon');

  let passwordVisible = false;

  // ─── Check if already logged in ──────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/verify', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const role = data.data && data.data.role;
        if (role === 'student') {
          window.location.href = 'student-dashboard.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }
    } catch (_) {
      // Not logged in — stay on page
    }
  }
  checkAuth();

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

  // ─── Toggle Password Visibility ──────────────────────────────────────────
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      passwordVisible = !passwordVisible;
      passwordInput.type = passwordVisible ? 'text' : 'password';
      eyeIcon.innerHTML = passwordVisible
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    });
  }

  // ─── Show / Hide Error ───────────────────────────────────────────────────
  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
    // Shake animation
    loginError.style.animation = 'none';
    requestAnimationFrame(() => {
      loginError.style.animation = 'shake 0.5s ease';
    });
  }

  function hideError() {
    loginError.classList.add('hidden');
  }

  // ─── Set Loading State ───────────────────────────────────────────────────
  function setLoading(loading) {
    if (loading) {
      loginLoading.classList.remove('hidden');
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing In…';
    } else {
      loginLoading.classList.add('hidden');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }

  // ─── Form Submit ─────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      // Store token for pages that might need it via header
      if (data.data && data.data.token) {
        localStorage.setItem('faceattend_token', data.data.token);
      }

      showToast('Login successful! Redirecting…', 'success');

      setTimeout(() => {
        const role = data.data && data.data.user && data.data.user.role;
        if (role === 'student') {
          window.location.href = 'student-dashboard.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 600);
    } catch (err) {
      console.error('[Admin] Login failed:', err);
      showError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  });

  // ─── Enter key on password → submit ──────────────────────────────────────
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
})();
