'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FaceAttend — Camera Feed & Face Detection (index.html)
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('face-canvas');
  const ctx = canvas.getContext('2d');
  const cameraToggle = document.getElementById('camera-toggle');
  const cameraBtnText = document.getElementById('camera-btn-text');
  const cameraDot = document.getElementById('camera-dot');
  const cameraStatusText = document.getElementById('camera-status-text');
  const unknownAlert = document.getElementById('unknown-alert');
  const registerUnknownBtn = document.getElementById('register-unknown-btn');
  const statPresent = document.getElementById('home-stat-present');
  const statAbsent = document.getElementById('home-stat-absent');
  const statTotal = document.getElementById('home-stat-total');

  let stream = null;
  let cameraActive = false;
  let detectInterval = null;
  let processingFrame = false;

  const DETECTION_INTERVAL = 2000; // ms between detection attempts
  const PYTHON_SERVICE = '/api/attendance'; // marks attendance via Node backend

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

  // ─── Load Today's Stats ──────────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch('/api/attendance/today', { credentials: 'include' });
      if (!res.ok) {
        // User might not be logged in — stats might require auth
        // Try unauthenticated endpoint or show defaults
        statPresent.textContent = '--';
        statAbsent.textContent = '--';
        statTotal.textContent = '--';
        return;
      }
      const data = await res.json();
      if (data.success) {
        statPresent.textContent = data.data.present || 0;
        statAbsent.textContent = data.data.absent || 0;
        statTotal.textContent = data.data.total_students || 0;
      }
    } catch (err) {
      console.warn('[App] Could not load stats:', err.message);
    }
  }
  loadStats();

  // ─── Camera Toggle ───────────────────────────────────────────────────────
  cameraToggle.addEventListener('click', async () => {
    if (cameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  });

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      video.srcObject = stream;
      await video.play();

      // Size canvas to match video
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      });

      cameraActive = true;
      cameraBtnText.textContent = 'Stop Camera';
      cameraDot.classList.add('active');
      cameraStatusText.textContent = 'Camera active — detecting faces…';
      showToast('Camera started successfully', 'success');

      // Start detection loop
      detectInterval = setInterval(detectFaces, DETECTION_INTERVAL);
    } catch (err) {
      console.error('[App] Camera error:', err);
      cameraStatusText.textContent = 'Camera access denied';
      showToast('Camera access denied. Please allow camera permissions.', 'error');
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (detectInterval) {
      clearInterval(detectInterval);
      detectInterval = null;
    }
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cameraActive = false;
    cameraBtnText.textContent = 'Start Camera';
    cameraDot.classList.remove('active');
    cameraStatusText.textContent = 'Camera inactive';
    unknownAlert.classList.add('hidden');
    showToast('Camera stopped', 'info');
  }

  // ─── Capture Frame as Base64 ─────────────────────────────────────────────
  function captureFrame() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    return tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // base64 only
  }

  // ─── Draw Face Box ───────────────────────────────────────────────────────
  function drawFaceBoxes(faces) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach((face) => {
      const { top, right, bottom, left, name, confidence } = face;

      const isUnknown = !name || name === 'Unknown';
      const color = isUnknown ? '#ef4444' : '#22c55e';

      // Draw rectangle
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, right - left, bottom - top);

      // Draw label background
      const label = isUnknown
        ? 'Unknown'
        : `${name} (${Math.round((confidence || 0) * 100)}%)`;
      ctx.font = '13px Inter, sans-serif';
      const labelWidth = ctx.measureText(label).width + 12;
      const labelHeight = 24;

      ctx.fillStyle = color;
      ctx.fillRect(left, top - labelHeight, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = '#fff';
      ctx.fillText(label, left + 6, top - 7);
    });
  }

  // ─── Detect Faces ────────────────────────────────────────────────────────
  async function detectFaces() {
    if (processingFrame || !cameraActive) return;
    processingFrame = true;

    try {
      const frameBase64 = captureFrame();

      // Send frame to Python microservice for detection
      const detectRes = await fetch('http://localhost:5001/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frameBase64 }),
      });

      if (!detectRes.ok) {
        processingFrame = false;
        return;
      }

      const detectData = await detectRes.json();

      if (!detectData.faces || detectData.faces.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        unknownAlert.classList.add('hidden');
        cameraStatusText.textContent = 'Camera active — no faces detected';
        processingFrame = false;
        return;
      }

      cameraStatusText.textContent = `Camera active — ${detectData.faces.length} face(s) detected`;

      // For each detected face, try to compare against known encodings
      const results = [];
      let hasUnknown = false;

      for (const face of detectData.faces) {
        if (face.encoding) {
          try {
            // Compare against known faces
            const known = await getKnownEncodings();

const compareRes = await fetch('http://localhost:5001/compare', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    encoding: face.encoding,
    known_encodings: known.encodings,
    known_ids: known.ids,
  }),
});

            if (compareRes.ok) {
              const compareData = await compareRes.json();
              if (compareData.match && compareData.student_id) {
                const [top, right, bottom, left] = face.location;

results.push({
  top,
  right,
  bottom,
  left,
  name: compareData.student_id,
  confidence: compareData.confidence,
  student_id: compareData.student_id,
});

                // Mark attendance
                await markAttendance(compareData.student_id);
              } else {
                results.push({ ...face.location, name: 'Unknown' });
                hasUnknown = true;
              }
            }
          } catch (compareErr) {
            console.warn('[App] Compare error:', compareErr);
            results.push({ ...face.location, name: 'Unknown' });
            hasUnknown = true;
          }
        } else {
          results.push({ ...face.location, name: 'Unknown' });
          hasUnknown = true;
        }
      }

      drawFaceBoxes(results);

      if (hasUnknown) {
        unknownAlert.classList.remove('hidden');
      } else {
        unknownAlert.classList.add('hidden');
      }
    } catch (err) {
      console.warn('[App] Detection error:', err.message);
    }

    processingFrame = false;
  }

  // ─── Get Known Encodings from Backend ────────────────────────────────────
  let cachedEncodings = null;
  let encodingsCachedAt = 0;
  const ENCODING_CACHE_TTL = 30000; // 30 seconds

  async function getKnownEncodings() {
  const now = Date.now();

  if (
    cachedEncodings &&
    now - encodingsCachedAt < ENCODING_CACHE_TTL
  ) {
    return cachedEncodings;
  }

  try {
    const res = await fetch('/api/students/all/list');

    if (!res.ok) {
      return {
        encodings: [],
        ids: [],
        names: [],
      };
    }

    const data = await res.json();

    const students = data.data || [];

    cachedEncodings = {
      encodings: students.map((s) => s.encoding),
      ids: students.map((s) => s.id),
      names: students.map((s) => s.name),
    };

    encodingsCachedAt = now;

    return cachedEncodings;
  } catch (err) {
    console.error(err);

    return {
      encodings: [],
      ids: [],
      names: [],
    };
  }
}

  // ─── Mark Attendance ─────────────────────────────────────────────────────
  const markedToday = new Set();

  async function markAttendance(studentId) {
    if (markedToday.has(studentId)) return;

    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: studentId }),
      });

      const data = await res.json();
      if (data.success) {
        markedToday.add(studentId);
        if (!data.data.already_marked) {
          showToast(`Attendance marked for ${data.data.student_name || 'student'}`, 'success');
          loadStats(); // refresh stats
        }
      }
    } catch (err) {
      console.warn('[App] Mark attendance error:', err.message);
    }
  }

  // ─── Register Unknown Button ─────────────────────────────────────────────
  if (registerUnknownBtn) {
    registerUnknownBtn.addEventListener('click', () => {
      // Redirect to registration page for new student
      window.location.href = 'register.html';
    });
  }

  // ─── Cleanup on page exit ────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  });
})();
