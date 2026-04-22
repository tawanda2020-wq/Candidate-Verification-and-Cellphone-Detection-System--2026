// ── CONFIG — Apps Script URL here ──────────────────────────────
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwFRfVdQJwYiSEv5VC_VSbzrwwrT0DU3H7yFXd91rUI00su5J2yUun6n2vk04yJVehmoQ/exec";

function showMsg(type) {
  ['msgError','msgLoading','msgSuccess'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
  if (type) document.getElementById('msg' + type.charAt(0).toUpperCase() + type.slice(1)).classList.add('show');
}

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    document.getElementById('msgErrorText').textContent = 'Please enter both username and password.';
    showMsg('error'); return;
  }

  showMsg('loading');
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password })
    });
    const data = await res.json();

    if (data.success) {
      // Store auth token in sessionStorage
      sessionStorage.setItem('examguard_token', data.token);
      sessionStorage.setItem('examguard_user',  data.username);
      sessionStorage.setItem('examguard_role',  data.role);
      showMsg('success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } else {
      document.getElementById('msgErrorText').textContent = data.error || 'Invalid credentials.';
      showMsg('error');
      btn.disabled = false;
    }
  } catch (err) {
    document.getElementById('msgErrorText').textContent = 'Network error. Check your connection.';
    showMsg('error');
    btn.disabled = false;
  }
}

// Allow Enter key to submit
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

// If already logged in, redirect
if (sessionStorage.getItem('examguard_token')) {
  window.location.href = 'dashboard.html';
}
