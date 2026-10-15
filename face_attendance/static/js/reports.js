/* ══════════════════════════════════════════════
   reports.js — Reports Page Logic
   ══════════════════════════════════════════════ */

let allData = [];
let filteredData = [];
let trendChart, deptChart;
let currentPage = 1;
const PAGE_SIZE = 20;

async function loadAllData() {
  const body = document.getElementById("reportBody");
  body.innerHTML = `<tr><td colspan="8" class="loading-row"><i class="fas fa-circle-notch fa-spin"></i> Loading records...</td></tr>`;
  try {
    allData = await fetch("/api/attendance/all").then(r => r.json());
    filteredData = [...allData];
    renderTable();
    renderSummary();
    buildCharts();
  } catch(e) {
    body.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--red)">Error loading data. Is the server running?</td></tr>`;
  }
}

function renderTable() {
  const body = document.getElementById("reportBody");
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filteredData.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    body.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--muted)"><i class="fas fa-search"></i> No records found.</td></tr>`;
    renderPagination();
    return;
  }

  body.innerHTML = slice.map((row, i) => {
    const conf = row.confidence || 0;
    const confClass = conf >= 80 ? "high" : conf >= 60 ? "med" : "low";
    return `
      <tr>
        <td style="color:var(--muted)">${start + i + 1}</td>
        <td style="font-weight:600">${row.student_name}</td>
        <td style="color:var(--muted)">${row.student_id}</td>
        <td>${row.department || "—"}</td>
        <td>${new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
        <td>${row.time}</td>
        <td><span class="conf-badge ${confClass}">${conf.toFixed(1)}%</span></td>
        <td><span class="badge present"><i class="fas fa-check"></i> ${row.status}</span></td>
      </tr>
    `;
  }).join("");

  renderPagination();
}

function renderPagination() {
  const pages = Math.ceil(filteredData.length / PAGE_SIZE);
  const container = document.getElementById("pagination");
  if (pages <= 1) { container.innerHTML = ""; return; }

  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>
    <i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - currentPage) <= 2) {
      html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 3) {
      html += `<span style="color:var(--muted);padding:0 4px">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? "disabled" : ""}>
    <i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = html;
}

function goPage(page) {
  const pages = Math.ceil(filteredData.length / PAGE_SIZE);
  if (page < 1 || page > pages) return;
  currentPage = page;
  renderTable();
}

function renderSummary() {
  const dates = new Set(filteredData.map(r => r.date));
  document.getElementById("rsTotalDays").textContent = dates.size;
  document.getElementById("rsTotalEntries").textContent = filteredData.length;

  if (filteredData.length && dates.size) {
    const rate = (filteredData.length / dates.size).toFixed(1);
    document.getElementById("rsAvgRate").textContent = rate + " / day";
  } else {
    document.getElementById("rsAvgRate").textContent = "—";
  }
}

function buildCharts() {
  // Trend chart
  const byDate = {};
  filteredData.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + 1; });
  const sortedDates = Object.keys(byDate).sort();
  const labels = sortedDates.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const counts = sortedDates.map(d => byDate[d]);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trendChart").getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Present",
        data: counts,
        backgroundColor: "rgba(79,142,247,0.6)",
        borderColor: "#4f8ef7",
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: chartTooltipStyle() },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8892a4", font: { size: 11 } } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8892a4", font: { size: 11 } }, beginAtZero: true }
      }
    }
  });

  // Department chart
  const byDept = {};
  filteredData.forEach(r => {
    const dept = r.department || "Unknown";
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  const depts = Object.keys(byDept);
  const COLORS = ["#4f8ef7","#22c55e","#f97316","#7c5cd8","#ef4444","#06b6d4","#eab308","#ec4899"];

  if (deptChart) deptChart.destroy();
  deptChart = new Chart(document.getElementById("deptChart").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: depts,
      datasets: [{ data: depts.map(d => byDept[d]), backgroundColor: COLORS.map(c => c + "cc"), borderColor: COLORS, borderWidth: 2, hoverOffset: 8 }]
    },
    options: {
      responsive: true, cutout: "60%",
      plugins: { legend: { position: "bottom", labels: { color: "#8892a4", padding: 12, font: { size: 11 } } }, tooltip: chartTooltipStyle() }
    }
  });
}

function chartTooltipStyle() {
  return { backgroundColor: "#1a2540", borderColor: "#1e2d4a", borderWidth: 1, titleColor: "#e8eaf0", bodyColor: "#8892a4", padding: 12 };
}

function applyFilter() {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const dept = document.getElementById("filterDept").value.toLowerCase();
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";

  filteredData = allData.filter(r => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (dept && !(r.department || "").toLowerCase().includes(dept)) return false;
    if (search && !r.student_name.toLowerCase().includes(search) && !r.student_id.toLowerCase().includes(search)) return false;
    return true;
  });
  currentPage = 1;
  renderTable();
  renderSummary();
  buildCharts();
}

function clearFilter() {
  document.getElementById("fromDate").value = "";
  document.getElementById("toDate").value = "";
  document.getElementById("filterDept").value = "";
  if (document.getElementById("searchInput")) document.getElementById("searchInput").value = "";
  filteredData = [...allData];
  currentPage = 1;
  renderTable();
  renderSummary();
  buildCharts();
}

function filterTable() { applyFilter(); }

function exportAllCSV() {
  const headers = ["#", "Name", "Student ID", "Department", "Date", "Time", "Confidence", "Status"];
  const rows = filteredData.map((r, i) => [
    i + 1, r.student_name, r.student_id, r.department || "", r.date, r.time,
    (r.confidence || 0).toFixed(1) + "%", r.status
  ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `attendance_report_${new Date().toISOString().split("T")[0]}.csv`; a.click();
  showToast("Report exported!", "success");
}

// Set default date range (last 30 days)
const today = new Date().toISOString().split("T")[0];
const last30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
const fromEl = document.getElementById("fromDate");
const toEl = document.getElementById("toDate");
if (fromEl) fromEl.value = last30;
if (toEl) toEl.value = today;

// Init
loadAllData();
