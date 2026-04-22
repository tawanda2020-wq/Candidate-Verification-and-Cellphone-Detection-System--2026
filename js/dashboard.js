// ══════════════════════════════════════════════════════════════════════════
//  EXAMGUARD DASHBOARD - JavaScript
// ══════════════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────────────
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwFRfVdQJwYiSEv5VC_VSbzrwwrT0DU3H7yFXd91rUI00su5J2yUun6n2vk04yJVehmoQ/exec";

// ── STATE ────────────────────────────────────────────────────────────────
let allEntryLogs   = [];
let allGadgetLogs  = [];
let allStudents    = [];
let statsData      = {};
let chartHourly    = null;
let chartPie       = null;
let chartHourly2   = null;
let chartPie2      = null;
let autoRefreshTimer = null;
let previousLogCount = 0;

// Chart.js global defaults for dark theme
Chart.defaults.color         = '#94a3b8';
Chart.defaults.borderColor   = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family   = "'DM Sans', sans-serif";

// ── AUTH CHECK ────────────────────────────────────────────────────────────
function checkAuth() {
  const token = sessionStorage.getItem('examguard_token');
  if (!token) { window.location.href = 'login.html'; return false; }
  const uname = sessionStorage.getItem('examguard_user') || 'Admin';
  const role  = sessionStorage.getItem('examguard_role')  || 'admin';
  document.getElementById('userName').textContent  = uname;
  document.getElementById('userRole').textContent  = role;
  document.getElementById('userAvatar').textContent = uname.charAt(0).toUpperCase();
  return true;
}

function logout() {
  const confirmLogout = confirm("Are you sure you want to sign out?");
  
  if (confirmLogout) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
  // If user clicks "Cancel", nothing happens
}

// ── CLOCK ──────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// ── PANEL NAVIGATION ────────────────────────────────────────────────────────
const panelTitles = {
  overview:  ['Dashboard Overview',   'Real-time monitoring of the exam entry system'],
  livelog:   ['Live Entry Log',        'Auto-refreshes every 10 seconds'],
  students:  ['Student Registry',      'Manage candidate records'],
  gadgets:   ['Gadget Detection Log',  'All RFID tag detection events'],
  analytics: ['Analytics & Charts',    'Visual breakdown of entry data'],
};

function switchPanel(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (el) el.classList.add('active');
  const [title, sub] = panelTitles[id] || ['', ''];
  document.getElementById('panelTitle').textContent = title;
  document.getElementById('panelSub').textContent   = sub;
  document.getElementById('newBadge').style.display = 'none';
}

// ── API HELPERS ─────────────────────────────────────────────────────────────
async function apiGet(action) {
  const res  = await fetch(BACKEND_URL + '?action=' + action);
  return res.json();
}
async function apiPost(body) {
  const res  = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  return res.json();
}

// ── LOAD ALL DATA ────────────────────────────────────────────────────────────
async function refreshAll() {
  try {
    await Promise.all([loadStats(), loadLogs(), loadStudents(), loadGadgetLog()]);
  } catch(e) {
    showToast('Network error: ' + e.message, 'error');
  }
}

async function loadStats() {
  const data = await apiGet('getStats');
  if (!data.success) return;
  statsData = data;

  // Stat cards
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('statStudents', data.totalStudents);
  set('statEntries',  data.entriesToday);
  set('statPass',     data.passToday);
  set('statGadgets',  data.gadgetsToday);
  set('aStatStudents',data.totalStudents);
  set('aStatEntries', data.entriesToday);
  set('aStatPass',    data.passToday);
  set('aStatGadgets', data.gadgetsToday);

  // Progress bars
  const total = data.entriesToday + data.gadgetsToday;
  if (total > 0) {
    const passP   = Math.round((data.passToday / total) * 100);
    const gadgetP = Math.round((data.gadgetsToday / total) * 100);
    const failP   = Math.max(0, 100 - passP - gadgetP);
    document.getElementById('passRatePct').textContent   = passP + '%';
    document.getElementById('gadgetRatePct').textContent = gadgetP + '%';
    document.getElementById('failRatePct').textContent   = failP + '%';
    document.getElementById('passBar').style.width   = passP + '%';
    document.getElementById('gadgetBar').style.width = gadgetP + '%';
    document.getElementById('failBar').style.width   = failP + '%';
  }

  renderHourlyChart(data.perHour);
  renderPieChart(data.passToday, data.failToday, data.gadgetsToday);
}

async function loadLogs() {
  const data = await apiGet('getLogs');
  if (!data.success) return;
  allEntryLogs = data.entryLogs || [];

  // Detect new entries
  if (allEntryLogs.length > previousLogCount && previousLogCount > 0) {
    document.getElementById('newBadge').style.display = 'flex';
    showToast('New entry activity detected', 'success');
  }
  previousLogCount = allEntryLogs.length;

  renderEntryLogTable(allEntryLogs, 'liveLogBody');
  renderEntryLogTable(allEntryLogs.slice(0, 8), 'overviewLogBody');
}

async function loadStudents() {
  const data = await apiGet('getStudents');
  if (!data.success) return;
  allStudents = data.students || [];
  renderStudentsTable(allStudents);
}

async function loadGadgetLog() {
  const data = await apiGet('getGadgetLog');
  if (!data.success) return;
  allGadgetLogs = data.logs || [];
  renderGadgetLogTable(allGadgetLogs);
}

// ── RENDER HELPERS ───────────────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts) return '_';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString();
}

function resultBadge(result) {
  if (!result) return '—';
  const r = result.toUpperCase();
  if (r === 'PASS')                           return `<span class="badge pass">✓ Pass</span>`;
  if (r.startsWith('FAIL') || r === 'FAIL')   return `<span class="badge fail">✗ ${result}</span>`;
  return `<span class="badge inactive">${result}</span>`;
}

function renderEntryLogTable(logs, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:2rem">No entries yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="color:var(--text-dim);font-size:.75rem">${formatTs(l.timestamp)}</td>
      <td><code style="font-size:.75rem;color:var(--teal)">${l.studentID || '—'}</code></td>
      <td style="font-weight:500">${l.name || '—'}</td>
      <td>${resultBadge(l.result)}</td>
      <td style="color:var(--text-dim);font-size:.78rem">${l.notes || '—'}</td>
    </tr>`).join('');
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('studentsBody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem">No students registered yet. Click "Add Student" to begin.</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map(s => {
    const statusBadge = s.status === 'ACTIVE'
      ? `<span class="badge active">Active</span>`
      : `<span class="badge inactive">${s.status || 'Unknown'}</span>`;
    return `<tr>
      <td><code style="font-size:.75rem;color:var(--teal)">${s.studentID||'—'}</code></td>
      <td style="font-weight:500">${s.name||'—'}</td>
      <td style="color:var(--text-dim)">${s.course||'—'}</td>
      <td style="text-align:center"><code style="color:var(--amber)">${s.fingerprintID||'—'}</code></td>
      <td style="font-size:.73rem;color:var(--text-dim)">${s.rfidUID||'—'}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-sm ghost" style="margin-right:.3rem" onclick="openEditStudentModal(${JSON.stringify(s).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn-sm danger" onclick="deleteStudent('${s.studentID}')">Del</button>
      </td>
    </tr>`;
  }).join('');
}

function renderGadgetLogTable(logs) {
  const tbody = document.getElementById('gadgetLogBody');
  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:2rem">No gadget detections recorded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="color:var(--text-dim);font-size:.75rem">${formatTs(l.timestamp)}</td>
      <td><code style="font-size:.75rem;color:var(--teal)">${l.studentID||'UNIDENTIFIED'}</code></td>
      <td><code style="font-size:.73rem;color:var(--orange)">${l.rfidUID||'—'}</code></td>
      <td><span class="badge gadget">📱 Gadget Detected</span></td>
    </tr>`).join('');
}

// ── SEARCH FILTERS ────────────────────────────────────────────────────────────
function filterLog() {
  const q = document.getElementById('searchLog').value.toLowerCase();
  const filtered = q
    ? allEntryLogs.filter(l => (l.name||'').toLowerCase().includes(q) || (l.studentID||'').toLowerCase().includes(q))
    : allEntryLogs;
  renderEntryLogTable(filtered, 'liveLogBody');
}

function filterStudents() {
  const q = document.getElementById('searchStudents').value.toLowerCase();
  const filtered = q
    ? allStudents.filter(s => (s.name||'').toLowerCase().includes(q) || (s.studentID||'').toLowerCase().includes(q))
    : allStudents;
  renderStudentsTable(filtered);
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function renderHourlyChart(perHour) {
  const labels = Array.from({length:24}, (_,i) => i + ':00');
  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Entries',
        data: perHour || new Array(24).fill(0),
        backgroundColor: 'rgba(245,158,11,0.55)',
        borderColor: 'rgba(245,158,11,0.9)',
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } }
      }
    }
  };

  if (chartHourly) { chartHourly.data.datasets[0].data = perHour || []; chartHourly.update(); }
  else { chartHourly = new Chart(document.getElementById('chartHourly'), cfg); }

  const cfg2 = JSON.parse(JSON.stringify(cfg));
  if (chartHourly2) { chartHourly2.data.datasets[0].data = perHour || []; chartHourly2.update(); }
  else { chartHourly2 = new Chart(document.getElementById('chartHourly2'), cfg2); }
}

function renderPieChart(pass, fail, gadgets) {
  const cfg = {
    type: 'doughnut',
    data: {
      labels: ['Pass', 'Denied', 'Gadget'],
      datasets: [{
        data: [pass || 0, fail || 0, gadgets || 0],
        backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(249,115,22,0.7)', 'rgba(239,68,68,0.7)'],
        borderColor:      ['#10b981', '#f97316', '#ef4444'],
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { padding: 15, font: { size: 11 } } } }
    }
  };

  if (chartPie) {
    chartPie.data.datasets[0].data = [pass||0, fail||0, gadgets||0]; chartPie.update();
  } else { chartPie = new Chart(document.getElementById('chartPie'), cfg); }

  if (chartPie2) {
    chartPie2.data.datasets[0].data = [pass||0, fail||0, gadgets||0]; chartPie2.update();
  } else { chartPie2 = new Chart(document.getElementById('chartPie2'), JSON.parse(JSON.stringify(cfg))); }
}

// ── STUDENT CRUD ──────────────────────────────────────────────────────────────
function openAddStudentModal() {
  document.getElementById('modalTitle').textContent = 'Add New Student';
  document.getElementById('modalSub').textContent   = 'Register a candidate in the exam database';
  document.getElementById('editStudentID').value = '';
  ['fStudentID','fName','fCourse','fFingerprintID','fRfidUID'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fStatus').value = 'ACTIVE';
  document.getElementById('saveStudentBtn').textContent = 'Save Student';
  openModal('studentModal');
}

function openEditStudentModal(s) {
  document.getElementById('modalTitle').textContent = 'Edit Student';
  document.getElementById('modalSub').textContent   = 'Update candidate record';
  document.getElementById('editStudentID').value    = s.studentID || '';
  document.getElementById('fStudentID').value       = s.studentID || '';
  document.getElementById('fName').value            = s.name      || '';
  document.getElementById('fCourse').value          = s.course    || '';
  document.getElementById('fFingerprintID').value   = s.fingerprintID || '';
  document.getElementById('fRfidUID').value         = s.rfidUID   || '';
  document.getElementById('fStatus').value          = s.status    || 'ACTIVE';
  document.getElementById('saveStudentBtn').textContent = 'Update Student';
  openModal('studentModal');
}

async function saveStudent() {
  const editID = document.getElementById('editStudentID').value;
  const payload = {
    studentID:    document.getElementById('fStudentID').value.trim(),
    name:         document.getElementById('fName').value.trim(),
    course:       document.getElementById('fCourse').value.trim(),
    fingerprintID:document.getElementById('fFingerprintID').value.trim(),
    rfidUID:      document.getElementById('fRfidUID').value.trim(),
    status:       document.getElementById('fStatus').value,
  };

  if (!payload.name) { showToast('Name is required.', 'error'); return; }

  payload.action = editID ? 'updateStudent' : 'addStudent';
  if (editID) payload.studentID = editID;

  const btn = document.getElementById('saveStudentBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = await apiPost(payload);
  btn.disabled = false; btn.textContent = editID ? 'Update Student' : 'Save Student';

  if (data.success) {
    closeModal('studentModal');
    showToast(editID ? 'Student updated successfully.' : 'Student added successfully.', 'success');
    await loadStudents();
    await loadStats();
  } else {
    showToast(data.error || 'Save failed.', 'error');
  }
}

async function deleteStudent(studentID) {
  if (!confirm('Mark student ' + studentID + ' as DELETED? This cannot be undone easily.')) return;
  const data = await apiPost({ action: 'deleteStudent', studentID });
  if (data.success) {
    showToast('Student removed.', 'success');
    await loadStudents();
    await loadStats();
  } else {
    showToast(data.error || 'Delete failed.', 'error');
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
function exportGadgetCSV() {
  if (!allGadgetLogs.length) { showToast('No gadget log data to export.', 'error'); return; }
  const headers = ['Timestamp','StudentID','RFID UID','Action'];
  const rows    = allGadgetLogs.map(l => [l.timestamp, l.studentID, l.rfidUID, l.action]);
  const csv     = [headers, ...rows].map(r => r.map(c => `"${c||''}"`).join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = 'gadget_log_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded.', 'success');
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = type === 'success' ? '✓ ' + msg : '✗ ' + msg;
  el.className   = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── AUTO-REFRESH ──────────────────────────────────────────────────────────────
function startAutoRefresh() {
  autoRefreshTimer = setInterval(() => {
    loadStats();
    loadLogs();
    loadGadgetLog();
  }, 10000); // every 10 seconds
}

// ── INIT ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!checkAuth()) return;
  await refreshAll();
  startAutoRefresh();
})();
