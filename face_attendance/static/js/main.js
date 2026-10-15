/* ══════════════════════════════════════════════
   main.js — Shared Utilities & Landing Page
   ══════════════════════════════════════════════ */

// ── Particle System ──────────────────────────
(function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.r = Math.random() * 1.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.5 ? "79,142,247" : "124,92,216";
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  // Draw connections
  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.strokeStyle = `rgba(79,142,247,${0.08 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(animate);
  }
  animate();
})();

// ── Navbar scroll effect ──
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if (nav) nav.classList.toggle("scrolled", window.scrollY > 40);
});

// ── Hamburger toggle ──
const ham = document.getElementById("hamburger");
if (ham) ham.addEventListener("click", () => {
  document.querySelector(".nav-links").classList.toggle("mobile-open");
});

// ── Number Counters ──
function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const isFloat = target % 1 !== 0;
  const duration = 2000;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = target * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.floor(val).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString();
  }
  requestAnimationFrame(step);
}

// ── Intersection Observer for animations ──
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    // Feature cards
    if (el.classList.contains("feature-card")) {
      const delay = parseInt(el.dataset.delay || 0);
      setTimeout(() => el.classList.add("visible"), delay);
    }
    // Counters (landing)
    if (el.classList.contains("counter") || el.classList.contains("stat-num")) {
      animateCounter(el);
    }
    io.unobserve(el);
  });
}, { threshold: 0.15 });

document.querySelectorAll(".feature-card, .counter, .stat-num").forEach(el => io.observe(el));

// ── Sidebar Toggle (App Pages) ──
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("click", e => {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });
}

// ── Modal helpers ──
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("open");
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("open");
}

// ── Set current date ──
const datEl = document.getElementById("currentDate");
if (datEl) {
  const now = new Date();
  datEl.textContent = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); }
  });
});

// Close modal on overlay click
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
});

// ── Toast notification ──
function showToast(msg, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:14px 20px;border-radius:12px;font-size:.9rem;font-weight:600;
    display:flex;align-items:center;gap:10px;
    animation:slideInRight .3s ease;
    box-shadow:0 8px 30px rgba(0,0,0,.4);
    border:1px solid;
    max-width:340px;
  `;
  const colors = {
    success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", color: "#22c55e", icon: "fa-check-circle" },
    error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#ef4444", icon: "fa-times-circle" },
    info: { bg: "rgba(79,142,247,0.15)", border: "rgba(79,142,247,0.4)", color: "#4f8ef7", icon: "fa-info-circle" },
    warning: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.4)", color: "#eab308", icon: "fa-exclamation-triangle" },
  };
  const c = colors[type] || colors.info;
  toast.style.background = c.bg; toast.style.borderColor = c.border; toast.style.color = c.color;
  toast.innerHTML = `<i class="fas ${c.icon}"></i><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.animation = "fadeIn .3s ease reverse"; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Export table to CSV ──
function tableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = [...table.querySelectorAll("tr")].map(row =>
    [...row.querySelectorAll("th,td")].map(c => `"${c.innerText.replace(/"/g,'""')}"`).join(",")
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "data.csv";
  a.click();
}

// ── Register student (dashboard) ──
let regStream = null;
async function startRegCam() {
  const isSecure = location.protocol === "https:" ||
                   location.hostname === "localhost" ||
                   location.hostname === "127.0.0.1" ||
                   location.hostname === "[::1]";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast(
      isSecure
        ? "Your browser does not support camera access (getUserMedia)."
        : "Camera blocked: open the app at http://localhost:5000 (not an IP address), or serve over HTTPS.",
      "error"
    );
    return;
  }

  try {
    regStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    const v = document.getElementById("regVideo");
    v.srcObject = regStream;
    await v.play().catch(err => { if (err.name !== "AbortError") throw err; });
    document.getElementById("startCamBtn").style.display = "none";
    document.getElementById("captureBtn").style.display = "inline-flex";
    document.getElementById("faceGuide").style.display = "none";
  } catch(e) {
    const messages = {
      NotAllowedError:      "Camera permission denied. Click the camera icon in the address bar and allow access.",
      PermissionDeniedError:"Camera permission denied. Allow camera access in browser settings.",
      NotFoundError:        "No camera found. Please connect a webcam and try again.",
      NotReadableError:     "Camera is in use by another application. Close Zoom/Teams/Skype and try again.",
      OverconstrainedError: "Camera does not support the requested resolution. Please try again.",
    };
    showToast(messages[e.name] || `Camera error (${e.name}): ${e.message}`, "error");
  }
}

function capturePhoto() {
  const v = document.getElementById("regVideo");
  const c = document.getElementById("regCanvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  const img = document.getElementById("capturedImg");
  img.src = c.toDataURL("image/jpeg", 0.9);
  img.style.display = "block";
  v.style.display = "none";
  document.getElementById("captureBtn").style.display = "none";
  document.getElementById("retakeBtn").style.display = "inline-flex";
}

function retakePhoto() {
  document.getElementById("capturedImg").style.display = "none";
  document.getElementById("regVideo").style.display = "block";
  document.getElementById("captureBtn").style.display = "inline-flex";
  document.getElementById("retakeBtn").style.display = "none";
}

async function registerStudent() {
  const name = document.getElementById("reg-name").value.trim();
  const sid = document.getElementById("reg-id").value.trim();
  const dept = document.getElementById("reg-dept").value;
  const email = document.getElementById("reg-email").value.trim();
  const imgEl = document.getElementById("capturedImg");
  const msgEl = document.getElementById("reg-msg");

  if (!name || !sid) { showToast("Name and Student ID are required", "error"); return; }
  if (!imgEl.src || imgEl.style.display === "none") { showToast("Please capture a photo first", "error"); return; }

  msgEl.textContent = "⏳ Processing face encoding...";
  msgEl.className = "alert-info info"; msgEl.style.display = "block";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, student_id: sid, department: dept, email, image: imgEl.src })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = "✅ " + data.message;
      msgEl.className = "alert-info success";
      showToast(data.message, "success");
      if (regStream) regStream.getTracks().forEach(t => t.stop());
      setTimeout(() => { closeModal("registerModal"); if (typeof loadStats === "function") loadStats(); }, 1500);
    } else {
      msgEl.textContent = "❌ " + data.message;
      msgEl.className = "alert-info error";
      showToast(data.message, "error");
    }
  } catch(e) {
    msgEl.textContent = "❌ Server error. Is the backend running?";
    msgEl.className = "alert-info error";
  }
}

async function loadStudents() {
  const grid = document.getElementById("studentGrid");
  if (!grid) return;
  grid.innerHTML = `<div style="color:var(--muted);padding:20px;grid-column:1/-1;text-align:center"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;
  try {
    const data = await fetch("/api/students").then(r => r.json());
    if (!data.length) { grid.innerHTML = `<div style="color:var(--muted);padding:20px;grid-column:1/-1;text-align:center">No students registered yet.</div>`; return; }
    grid.innerHTML = data.map(s => `
      <div class="student-card">
        <img src="${s.image_path || ''}" onerror="this.src=''" alt="${s.name}"
             style="${s.image_path ? '' : 'display:none'}"/>
        ${!s.image_path ? `<div style="width:72px;height:72px;border-radius:50%;background:var(--surface);border:3px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:1.5rem;color:var(--muted)"><i class="fas fa-user"></i></div>` : ''}
        <div class="sc-name">${s.name}</div>
        <div class="sc-id">${s.student_id}</div>
        ${s.department ? `<div class="sc-dept">${s.department}</div>` : ''}
        <button class="sc-del" onclick="deleteStudent('${s.student_id}', this)"><i class="fas fa-trash"></i> Remove</button>
      </div>
    `).join("");
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--red);padding:20px;grid-column:1/-1">Error loading students.</div>`;
  }
}

async function deleteStudent(sid, btn) {
  if (!confirm(`Remove student ${sid}?`)) return;
  btn.disabled = true; btn.textContent = "Removing...";
  try {
    await fetch(`/api/students/${sid}`, { method: "DELETE" });
    btn.closest(".student-card").remove();
    showToast("Student removed", "info");
    if (typeof loadStats === "function") loadStats();
  } catch(e) {
    showToast("Error removing student", "error");
    btn.disabled = false; btn.textContent = "Remove";
  }
}

function exportCSV() { tableToCSV("reportTable", "attendance.csv"); }
function exportAllCSV() { tableToCSV("reportTable", "attendance_all.csv"); }
