'use strict';

// ─── Toast helper ───────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── DOM refs ───────────────────────────────────────────────────────────────
const form = document.getElementById('register-form');
const errorDiv = document.getElementById('register-error');
const loadingDiv = document.getElementById('register-loading');
const successDiv = document.getElementById('register-success');
const submitBtn = document.getElementById('register-btn');

// ─── Show/hide helpers ──────────────────────────────────────────────────────
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  errorDiv.classList.add('hidden');
}

function setLoading(on) {
  if (on) {
    loadingDiv.classList.remove('hidden');
    submitBtn.disabled = true;
  } else {
    loadingDiv.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

// ─── Form submit ────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const roll_number = document.getElementById('reg-roll').value.trim();
  const department = document.getElementById('reg-dept').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  // Client-side validation
  if (!name || !email || !roll_number || !department || !password) {
    showError('Please fill in all fields.');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }

  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, roll_number, department }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showError(data.error || 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    // Show success + redirect to OTP page
    form.classList.add('hidden');
    successDiv.classList.remove('hidden');
    setLoading(false);

    setTimeout(() => {
      window.location.href = `verify-otp.html?email=${encodeURIComponent(email)}`;
    }, 2000);
  } catch (err) {
    console.error('Registration error:', err);
    showError('Network error. Please check your connection.');
    setLoading(false);
  }
});
