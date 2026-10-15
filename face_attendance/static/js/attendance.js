/* ══════════════════════════════════════════════
   attendance.js — Live Camera & Face Recognition
   ══════════════════════════════════════════════ */

let camStream        = null;
let autoScanInterval = null;
let autoScanActive   = false;
let todayLog         = [];
let isScanning       = false;   // prevent overlapping scan requests

// ── Camera Start ─────────────────────────────────────────────────
async function startAttendCam() {
  // getUserMedia requires either HTTPS or a localhost/loopback origin.
  // Plain HTTP over a network IP is blocked by browsers for security.
  const isSecure = location.protocol === "https:" ||
                   location.hostname === "localhost" ||
                   location.hostname === "127.0.0.1" ||
                   location.hostname === "[::1]";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (!isSecure) {
      showToast(
        "Camera blocked: open the app at http://localhost:5000 (not an IP address), or serve over HTTPS.",
        "error"
      );
    } else {
      showToast("Your browser does not support camera access (getUserMedia).", "error");
    }
    return;
  }

  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:      { ideal: 1280 },
        height:     { ideal: 720  },
        facingMode: "user"
      },
      audio: false
    });

    const v = document.getElementById("attendVideo");
    v.srcObject = camStream;

    // Wait for video metadata to load, then confirm it's playing
    await new Promise((resolve, reject) => {
      v.onloadedmetadata = () => {
        v.play()
          .then(resolve)
          .catch(err => {
            // AbortError is harmless when autoplay already started the video
            if (err.name === "AbortError") resolve();
            else reject(err);
          });
      };
      v.onerror = reject;
      // Timeout safety net
      setTimeout(() => resolve(), 3000);
    });

    // Show live UI
    setUIState("live");
    showToast("Camera started — ready to scan!", "success");
    await loadTodayLog();

  } catch (err) {
    // Friendly messages for every known DOMException type
    const messages = {
      NotAllowedError:    "Camera permission denied. Click the camera icon in your browser address bar and allow access.",
      PermissionDeniedError: "Camera permission denied. Allow camera access in browser settings.",
      NotFoundError:      "No camera found. Please connect a webcam and try again.",
      DevicesNotFoundError: "No camera found. Please connect a webcam and try again.",
      NotReadableError:   "Camera is in use by another application. Close Zoom/Teams/Skype and try again.",
      TrackStartError:    "Camera is in use by another application. Close Zoom/Teams/Skype and try again.",
      OverconstrainedError: "Camera does not support the requested resolution. Trying lower quality…",
      TypeError:          "Invalid camera constraint. Please refresh the page and try again.",
    };
    const msg = messages[err.name] || `Camera error (${err.name}): ${err.message || "Unknown error"}`;
    showToast(msg, "error");

    // Fallback: retry with minimal constraints
    if (err.name === "OverconstrainedError") {
      retryWithBasicConstraints();
    }
  }
}

// Fallback with no constraints if ideal resolution fails
async function retryWithBasicConstraints() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const v = document.getElementById("attendVideo");
    v.srcObject = camStream;
    v.play().catch(() => {});
    setUIState("live");
    showToast("Camera started (fallback mode)", "success");
    await loadTodayLog();
  } catch (err) {
    showToast("Could not start camera even in fallback mode: " + err.message, "error");
  }
}

// ── Camera Stop ──────────────────────────────────────────────────
function stopCamera() {
  if (autoScanInterval) { clearInterval(autoScanInterval); autoScanInterval = null; }
  autoScanActive = false;
  isScanning     = false;

  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }

  const v = document.getElementById("attendVideo");
  v.srcObject = null;

  setUIState("off");
  document.getElementById("resultCard").style.display = "none";

  const btn = document.getElementById("autoScanBtn");
  btn.innerHTML = `<i class="fas fa-sync"></i> Auto Scan: OFF`;
  btn.style.background = "";
}

// ── UI State Helper ──────────────────────────────────────────────
function setUIState(state) {
  const live = state === "live";
  document.getElementById("camOverlay").style.display   = live ? "none"        : "flex";
  document.getElementById("scanOverlay").style.display  = live ? "block"       : "none";
  document.getElementById("startBtn").style.display     = live ? "none"        : "inline-flex";
  document.getElementById("autoScanBtn").style.display  = live ? "inline-flex" : "none";
  document.getElementById("snapBtn").style.display      = live ? "inline-flex" : "none";
  document.getElementById("stopBtn").style.display      = live ? "inline-flex" : "none";
  document.getElementById("camStatus").innerHTML = live
    ? `<span class="dot green"></span> Camera Live`
    : `<span class="dot red"></span> Camera Off`;
}

// ── Auto Scan Toggle ─────────────────────────────────────────────
function toggleAutoScan() {
  const btn = document.getElementById("autoScanBtn");
  autoScanActive = !autoScanActive;

  if (autoScanActive) {
    btn.innerHTML       = `<i class="fas fa-sync fa-spin"></i> Auto Scan: ON`;
    btn.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
    autoScanInterval    = setInterval(takeSnapshot, 3000);
    showToast("Auto scan ON — scanning every 3 seconds", "info");
  } else {
    btn.innerHTML       = `<i class="fas fa-sync"></i> Auto Scan: OFF`;
    btn.style.background = "";
    clearInterval(autoScanInterval);
    autoScanInterval = null;
    showToast("Auto scan OFF", "info");
  }
}

// ── Take Snapshot & Recognise ────────────────────────────────────
async function takeSnapshot() {
  if (isScanning) return;                    // skip if previous request still running
  if (!camStream) return;

  const v = document.getElementById("attendVideo");
  if (!v || v.readyState < 2 || v.videoWidth === 0) {
    showToast("Camera not ready yet — please wait a moment.", "warning");
    return;
  }

  const c = document.getElementById("attendCanvas");
  c.width  = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  const imageData = c.toDataURL("image/jpeg", 0.85);

  isScanning = true;
  try {
    const res = await fetch("/api/recognize", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image: imageData })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBadge(err.message || "Server error", "fail");
      return;
    }

    const data = await res.json();

    if (!data.success) {
      showBadge(data.message || "No face detected", "fail");
      return;
    }

    if (!data.results || data.results.length === 0) {
      showBadge("No face detected", "fail");
      return;
    }

    data.results.forEach(r => handleRecognitionResult(r));

  } catch (e) {
    console.error("Snapshot error:", e);
    showBadge("Network error — is the server running?", "fail");
  } finally {
    isScanning = false;
  }
}

// ── Handle Recognition Result ────────────────────────────────────
function handleRecognitionResult(r) {
  const resultCard = document.getElementById("resultCard");
  const icon       = document.getElementById("resultIcon");
  const nameEl     = document.getElementById("resultName");
  const detailsEl  = document.getElementById("resultDetails");
  const confFill   = document.getElementById("confFill");
  const confText   = document.getElementById("confText");
  const badge      = document.getElementById("recognitionBadge");

  resultCard.style.display = "flex";
  const conf = typeof r.confidence === "number" ? r.confidence : 0;

  if (r.name === "Unknown") {
    icon.className     = "result-icon fail";
    icon.innerHTML     = `<i class="fas fa-user-times"></i>`;
    nameEl.textContent = "Unknown Person";
    detailsEl.textContent = `Match: ${conf.toFixed(1)}% — Not registered in system`;
    confFill.style.width  = conf + "%";
    confText.textContent  = `${conf.toFixed(1)}% match`;
    badge.textContent     = "🔍 Unknown";
    badge.className       = "recognition-badge fail";
    badge.style.display   = "block";

  } else if (r.already_marked) {
    icon.className     = "result-icon duplicate";
    icon.innerHTML     = `<i class="fas fa-clock"></i>`;
    nameEl.textContent = r.name;
    detailsEl.textContent = `${r.department || ""}  •  Already marked present today`;
    confFill.style.width  = conf + "%";
    confText.textContent  = `${conf.toFixed(1)}% confidence`;
    badge.textContent     = `⏰ Already Marked — ${r.name}`;
    badge.className       = "recognition-badge duplicate";
    badge.style.display   = "block";
    showToast(`${r.name} — already marked present today`, "warning");

  } else {
    icon.className     = "result-icon success";
    icon.innerHTML     = `<i class="fas fa-user-check"></i>`;
    nameEl.textContent = r.name;
    detailsEl.textContent = `${r.student_id}  •  ${r.department || "No dept"}  •  ✅ Attendance Marked`;
    confFill.style.width  = conf + "%";
    confText.textContent  = `${conf.toFixed(1)}% confidence`;
    badge.textContent     = `✅ ${r.name} — Present!`;
    badge.className       = "recognition-badge success";
    badge.style.display   = "block";
    showToast(`✅ ${r.name} marked present!`, "success");
    addLogEntry(r);
  }

  setTimeout(() => { badge.style.display = "none"; }, 3500);
}

// ── Add entry to live log panel ──────────────────────────────────
function addLogEntry(r) {
  const list  = document.getElementById("logList");
  const empty = list.querySelector(".log-empty");
  if (empty) empty.remove();

  const entry = document.createElement("div");
  entry.className = "log-entry";
  const conf = typeof r.confidence === "number" ? r.confidence.toFixed(1) : "—";
  entry.innerHTML = `
    <div class="log-entry-icon"><i class="fas fa-check"></i></div>
    <div class="log-entry-info">
      <div class="log-entry-name">${r.name}</div>
      <div class="log-entry-detail">${r.student_id} · ${r.department || "—"} · ${conf}%</div>
    </div>
    <div class="log-entry-time">${new Date().toLocaleTimeString()}</div>
  `;
  list.insertBefore(entry, list.firstChild);
  todayLog.unshift(r);
  document.getElementById("logCount").textContent = `${todayLog.length} checked in`;
}

// ── Show overlay badge on video frame ───────────────────────────
function showBadge(msg, type) {
  const badge = document.getElementById("recognitionBadge");
  badge.textContent   = msg;
  badge.className     = `recognition-badge ${type}`;
  badge.style.display = "block";
  setTimeout(() => { badge.style.display = "none"; }, 2500);
}

// ── Load today's attendance log on page open ─────────────────────
async function loadTodayLog() {
  const today = new Date().toISOString().split("T")[0];
  try {
    const data = await fetch(`/api/attendance?date=${today}`).then(r => r.json());
    todayLog   = Array.isArray(data) ? data : [];
    const list = document.getElementById("logList");

    if (!todayLog.length) {
      list.innerHTML = `<div class="log-empty"><i class="fas fa-clock"></i><p>No attendance recorded yet today.</p></div>`;
      document.getElementById("logCount").textContent = "0 checked in";
      return;
    }

    list.innerHTML = "";
    todayLog.forEach(row => {
      const entry = document.createElement("div");
      entry.className = "log-entry";
      entry.innerHTML = `
        <div class="log-entry-icon"><i class="fas fa-check"></i></div>
        <div class="log-entry-info">
          <div class="log-entry-name">${row.student_name}</div>
          <div class="log-entry-detail">${row.student_id} · ${row.department || "—"}</div>
        </div>
        <div class="log-entry-time">${row.time}</div>
      `;
      list.appendChild(entry);
    });
    document.getElementById("logCount").textContent = `${todayLog.length} checked in`;

  } catch (e) {
    console.error("Error loading today log:", e);
  }
}

// ── Load log on page init ────────────────────────────────────────
loadTodayLog();
