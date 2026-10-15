/* ══════════════════════════════════════════════
   dashboard.js — Dashboard Charts & Data
   ══════════════════════════════════════════════ */

let weeklyChart, pieChart;

async function loadStats() {
  try {
    const data = await fetch("/api/stats").then(r => r.json());
    document.getElementById("totalStudents").textContent = data.total_students;
    document.getElementById("todayPresent").textContent = data.today_present;
    document.getElementById("todayAbsent").textContent = data.today_absent;
    document.getElementById("totalRecords").textContent = data.total_records;
    document.getElementById("attendanceRateDisplay").textContent = data.attendance_rate + "%";

    buildWeeklyChart(data.weekly);
    buildPieChart(data.today_present, data.today_absent);
  } catch(e) {
    console.error("Failed to load stats:", e);
  }
}

function buildWeeklyChart(weekly) {
  const labels = weekly.map(w => {
    const d = new Date(w.date);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }).reverse();
  const counts = weekly.map(w => w.count).reverse();

  if (weeklyChart) weeklyChart.destroy();
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  weeklyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Attendance",
        data: counts,
        borderColor: "#4f8ef7",
        backgroundColor: "rgba(79,142,247,0.08)",
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#4f8ef7",
        pointRadius: 5,
        pointHoverRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a2540",
          borderColor: "#1e2d4a",
          borderWidth: 1,
          titleColor: "#e8eaf0",
          bodyColor: "#8892a4",
          padding: 12,
        }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8892a4", font: { size: 11 } } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8892a4", font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

function buildPieChart(present, absent) {
  if (pieChart) pieChart.destroy();
  const ctx = document.getElementById("pieChart").getContext("2d");
  // If no data yet, show a placeholder slice so Chart.js doesn't crash
  const hasData = present > 0 || absent > 0;
  pieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: hasData ? ["Present", "Absent"] : ["No data yet"],
      datasets: [{
        data: hasData ? [present, absent] : [1],
        backgroundColor: hasData
          ? ["rgba(34,197,94,0.8)", "rgba(239,68,68,0.8)"]
          : ["rgba(255,255,255,0.05)"],
        borderColor: hasData ? ["#22c55e", "#ef4444"] : ["rgba(255,255,255,0.1)"],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#8892a4", padding: 16, font: { size: 12 } } },
        tooltip: { enabled: hasData,
          backgroundColor: "#1a2540", borderColor: "#1e2d4a", borderWidth: 1,
          titleColor: "#e8eaf0", bodyColor: "#8892a4", padding: 12,
        }
      }
    }
  });
}

async function loadTodayAttendance() {
  const body = document.getElementById("attendanceBody");
  const dateInput = document.getElementById("filterDate");
  const date = dateInput ? dateInput.value : new Date().toISOString().split("T")[0];
  body.innerHTML = `<tr><td colspan="8" class="loading-row"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>`;
  try {
    const data = await fetch(`/api/attendance?date=${date}`).then(r => r.json());
    if (!data.length) {
      body.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--muted)"><i class="fas fa-calendar-times"></i> No attendance records for this date.</td></tr>`;
      return;
    }
    body.innerHTML = data.map((row, i) => {
      const conf = row.confidence || 0;
      const confClass = conf >= 80 ? "high" : conf >= 60 ? "med" : "low";
      const imgPath = row.student_id ? `/static/faces/${row.student_id}.jpg` : "";
      return `
        <tr>
          <td style="color:var(--muted)">${i + 1}</td>
          <td>
            <div class="student-thumb">
              <img src="${imgPath}" onerror="this.parentElement.innerHTML='<i class=\\"fas fa-user\\"></i>'" alt=""/>
            </div>
          </td>
          <td style="font-weight:600">${row.student_name}</td>
          <td style="color:var(--muted)">${row.student_id}</td>
          <td>${row.department || "—"}</td>
          <td>${row.time}</td>
          <td><span class="conf-badge ${confClass}">${conf.toFixed(1)}%</span></td>
          <td><span class="badge present"><i class="fas fa-check"></i> ${row.status}</span></td>
        </tr>
      `;
    }).join("");
  } catch(e) {
    body.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--red)">Error loading data.</td></tr>`;
  }
}

function exportCSV() {
  const table = document.querySelector(".att-table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tr")].map(r =>
    [...r.querySelectorAll("th,td")]
      .filter((_, i) => i !== 1)  // skip photo column
      .map(c => `"${c.innerText.replace(/"/g,'""')}"`).join(",")
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`; a.click();
}

// Set today's date in filter
const filterDate = document.getElementById("filterDate");
if (filterDate) filterDate.value = new Date().toISOString().split("T")[0];

// Init on load
loadStats();
loadTodayAttendance();
