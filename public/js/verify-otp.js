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

// ─── Get email from URL ────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const email = params.get('email');

if (!email) {
  window.location.href = 'register.html';
}

// ─── DOM refs ───────────────────────────────────────────────────────────────
const emailDisplay = document.getElementById('otp-email-display');
const subtitle = document.getElementById('otp-subtitle');
const otpForm = document.getElementById('otp-form');
const formContainer = document.getElementById('otp-form-container');
const successDiv = document.getElementById('otp-success');
const errorDiv = document.getElementById('otp-error');
const loadingDiv = document.getElementById('otp-loading');
const verifyBtn = document.getElementById('verify-btn');
const resendBtn = document.getElementById('resend-btn');
const resendTimer = document.getElementById('resend-timer');
const digits = document.querySelectorAll('.otp-digit');

// Show email
const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c);
emailDisplay.textContent = maskedEmail;
subtitle.textContent = `Enter the 6-digit code sent to your email`;

// ─── OTP digit input handling ───────────────────────────────────────────────
digits.forEach((input, idx) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(0, 1);

    if (val && idx < digits.length - 1) {
      digits[idx + 1].focus();
    }

    checkComplete();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      digits[idx - 1].focus();
      digits[idx - 1].value = '';
    }
    if (e.key === 'ArrowLeft' && idx > 0) digits[idx - 1].focus();
    if (e.key === 'ArrowRight' && idx < digits.length - 1) digits[idx + 1].focus();
  });

  // Handle paste
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((char, i) => {
      if (digits[i]) digits[i].value = char;
    });
    if (pasted.length > 0) {
      const focusIdx = Math.min(pasted.length, digits.length - 1);
      digits[focusIdx].focus();
    }
    checkComplete();
  });
});

function checkComplete() {
  const otp = getOTP();
  verifyBtn.disabled = otp.length !== 6;
}

function getOTP() {
  return Array.from(digits).map((d) => d.value).join('');
}

// ─── Show/hide helpers ──────────────────────────────────────────────────────
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  errorDiv.classList.add('hidden');
}

function setLoading(on) {
  if (on) loadingDiv.classList.remove('hidden');
  else loadingDiv.classList.add('hidden');
}

// ─── Resend cooldown timer ──────────────────────────────────────────────────
let resendCooldown = 120; // 2 minutes
let resendInterval = null;

function startResendTimer() {
  resendBtn.disabled = true;
  resendCooldown = 120;
  updateTimerDisplay();

  resendInterval = setInterval(() => {
    resendCooldown--;
    updateTimerDisplay();
    if (resendCooldown <= 0) {
      clearInterval(resendInterval);
      resendBtn.disabled = false;
      resendTimer.textContent = '';
    }
  }, 1000);
}

function updateTimerDisplay() {
  const min = Math.floor(resendCooldown / 60);
  const sec = resendCooldown % 60;
  resendTimer.textContent = `Resend in ${min}:${sec.toString().padStart(2, '0')}`;
}

// Start timer on page load
startResendTimer();

// ─── Resend OTP ─────────────────────────────────────────────────────────────
resendBtn.addEventListener('click', async () => {
  hideError();
  resendBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showError(data.error || 'Failed to resend OTP.');
      resendBtn.disabled = false;
      return;
    }

    showToast('OTP sent successfully!', 'success');
    startResendTimer();

    // Clear inputs
    digits.forEach((d) => (d.value = ''));
    digits[0].focus();
    checkComplete();
  } catch (err) {
    console.error('Resend error:', err);
    showError('Network error. Please try again.');
    resendBtn.disabled = false;
  }
});

// ─── Verify OTP ─────────────────────────────────────────────────────────────
otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const otp = getOTP();
  if (otp.length !== 6) {
    showError('Please enter the complete 6-digit code.');
    return;
  }

  setLoading(true);
  verifyBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showError(data.error || 'Verification failed.');
      setLoading(false);
      verifyBtn.disabled = false;

      // Shake the inputs on error
      const inputGroup = document.querySelector('.otp-input-group');
      inputGroup.classList.add('shake');
      setTimeout(() => inputGroup.classList.remove('shake'), 500);

      // Clear inputs
      digits.forEach((d) => (d.value = ''));
      digits[0].focus();
      checkComplete();
      return;
    }

    // Success!
    setLoading(false);
    formContainer.classList.add('hidden');
    successDiv.classList.remove('hidden');
    showToast('Email verified successfully!', 'success');

    if (resendInterval) clearInterval(resendInterval);
  } catch (err) {
    console.error('Verify error:', err);
    showError('Network error. Please try again.');
    setLoading(false);
    verifyBtn.disabled = false;
  }
});
