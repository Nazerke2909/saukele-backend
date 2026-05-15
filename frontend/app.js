const API = window.location.origin;
let accessToken = localStorage.getItem('accessToken') || '';
let storedRefreshToken = localStorage.getItem('refreshToken') || '';

// ─── Helpers ───────────────────────────────────────────────────

function getUserRole() {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!accessToken;
}

// ─── Toast notification system ────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function friendlyMessage(status, data) {
  // Use server message if available
  if (data && data.message) return data.message;
  if (data && data.error) return data.error;

  // Success messages
  if (status >= 200 && status < 300) {
    if (data && data.accessToken) return 'You have logged in successfully!';
    if (data && data.id && data.email) return 'Account created successfully!';
    if (data && data.id) return 'Created successfully!';
    if (Array.isArray(data)) return `Found ${data.length} record(s)`;
    if (data && data.status === 'ok') return 'Server is healthy';
    return 'Operation completed successfully!';
  }

  // Error messages
  if (status === 400) return 'Invalid input. Please check your data.';
  if (status === 401) return 'Please log in first.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'Not found.';
  if (status === 409) return 'Conflict: this resource already exists.';
  if (status === 429) return 'Too many requests. Please wait a moment.';
  if (status >= 500) return 'Server error. Please try again later.';

  return `Error: ${JSON.stringify(data)}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, data, ok: res.ok };
}

function showResult(id, result) {
  const el = document.getElementById(id);
  if (!el) return;
  const msg = friendlyMessage(result.status, result.data);
  el.textContent = msg;
  // Show toast notification
  const type = result.ok ? 'success' : 'error';
  showToast(msg, type);
}

function showRaw(id, result) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = JSON.stringify(result.data, null, 2);
}

function updateAuthUI() {
  const role = getUserRole();
  const loggedIn = isLoggedIn();

  if (loggedIn) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      document.getElementById('user-info').classList.remove('hidden');
      document.getElementById('user-name').textContent = payload.email || 'User';
      document.getElementById('user-role').textContent = role || '—';
      document.getElementById('logout-btn').classList.remove('hidden');
    } catch {
      document.getElementById('user-info').classList.add('hidden');
      document.getElementById('logout-btn').classList.add('hidden');
    }
  } else {
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
  }

  // ─── Role-based visibility ──────────────────────────────
  const isAdmin = role === 'SUPER_ADMIN';
  const isModerator = role === 'MODERATOR';
  const isCouple = role === 'COUPLE';
  const isGuest = role === 'GUEST' || role === 'FAMILY_MEMBER' || !loggedIn;

  // Admin tab — only for SUPER_ADMIN
  document.querySelector('.nav-btn[data-section="admin"]').style.display = isAdmin ? '' : 'none';
  // Moderator tab — only for MODERATOR or SUPER_ADMIN
  document.querySelector('.nav-btn[data-section="moderator"]').style.display = (isModerator || isAdmin) ? '' : 'none';

  // Weddings — create/delete only for COUPLE or higher
  document.getElementById('btn-create-wedding').style.display = (isCouple || isModerator || isAdmin) ? '' : 'none';
  document.getElementById('btn-delete-wedding').style.display = (isCouple || isAdmin) ? '' : 'none';

  // Pools — create only for COUPLE or higher
  document.getElementById('btn-create-pool').style.display = (isCouple || isModerator || isAdmin) ? '' : 'none';
  document.getElementById('btn-purchase-pool').style.display = (isCouple || isAdmin) ? '' : 'none';
  document.getElementById('btn-deliver-pool').style.display = (isCouple || isAdmin) ? '' : 'none';
  document.getElementById('btn-delete-pool').style.display = (isAdmin) ? '' : 'none';

  // Contributions — anyone can contribute if logged in
  document.getElementById('btn-create-contribution').style.display = loggedIn ? '' : 'none';

  // Family — add/remove only for COUPLE or higher
  document.getElementById('btn-add-family').style.display = (isCouple || isAdmin) ? '' : 'none';
  document.getElementById('btn-remove-family').style.display = (isCouple || isAdmin) ? '' : 'none';
  document.getElementById('btn-send-reminders').style.display = (isCouple || isAdmin) ? '' : 'none';
}

// ── Navigation ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('section-' + btn.dataset.section).classList.add('active');
  });
});

// ── Auth ──
async function register() {
  const res = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-pass').value,
            fullName: document.getElementById('reg-first').value + ' ' + document.getElementById('reg-last').value,
      role: document.getElementById('reg-role').value,
    }),
  });
  showResult('reg-result', res);
}

async function login() {
  const res = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-pass').value,
    }),
  });
  showResult('login-result', res);
  if (res.data.accessToken) {
    accessToken = res.data.accessToken;
    storedRefreshToken = res.data.refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', storedRefreshToken);
    updateAuthUI();
  }
}

async function verifyEmail() {
  const res = await api('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({
      email: document.getElementById('verify-email').value,
      code: document.getElementById('verify-code').value,
    }),
  });
  showResult('verify-result', res);
}

async function refreshToken() {
  const res = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: storedRefreshToken }),
  });
  showResult('refresh-result', res);
  if (res.data.accessToken) {
    accessToken = res.data.accessToken;
    localStorage.setItem('accessToken', accessToken);
    updateAuthUI();
  }
}

async function getMe() {
  const res = await api('/auth/me');
  showRaw('me-result', res);
}

async function updateProfile() {
  const first = document.getElementById('profile-first').value;
  const last = document.getElementById('profile-last').value;
  const body = {};
  if (first) body.firstName = first;
  if (last) body.lastName = last;
  const res = await api('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  showResult('profile-result', res);
}

async function forgotPassword() {
  const res = await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: document.getElementById('forgot-email').value }),
  });
  showResult('forgot-result', res);
}

async function logout() {
  const res = await api('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: storedRefreshToken }),
  });
  showResult('logout-result', res);
  accessToken = '';
  storedRefreshToken = '';
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  updateAuthUI();
}

// ── Weddings ──
async function createWedding() {
  const res = await api('/weddings', {
    method: 'POST',
    body: JSON.stringify({
      title: document.getElementById('w-title').value,
      date: document.getElementById('w-date').value || new Date().toISOString(),
      location: document.getElementById('w-location').value,
    }),
  });
  showResult('w-create-result', res);
}

async function listWeddings() {
  const res = await api('/weddings');
  showRaw('w-list-result', res);
}

async function getWedding() {
  const id = document.getElementById('w-id').value;
  const res = await api(`/weddings/${id}`);
  showRaw('w-result', res);
}

async function deleteWedding() {
  const id = document.getElementById('w-id').value;
  const res = await api(`/weddings/${id}`, { method: 'DELETE' });
  showResult('w-result', res);
}

// ── Pools ──
async function createPool() {
  const res = await api('/pools', {
    method: 'POST',
    body: JSON.stringify({
      weddingId: parseInt(document.getElementById('p-wedding-id').value),
      name: document.getElementById('p-name').value,
      targetKzt: parseInt(document.getElementById('p-target').value),
      description: document.getElementById('p-desc').value,
      familyOnly: document.getElementById('p-family').checked,
    }),
  });
  showResult('p-create-result', res);
}

async function listPools() {
  const weddingId = document.getElementById('p-list-wedding-id').value;
  const res = await api(`/pools?weddingId=${weddingId}`);
  showRaw('p-list-result', res);
}

async function getPool() {
  const id = document.getElementById('p-id').value;
  const res = await api(`/pools/${id}`);
  showRaw('p-result', res);
}

async function updatePoolStatus() {
  const id = document.getElementById('p-id').value;
  const status = document.getElementById('p-new-status').value;
  const res = await api(`/pools/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  showResult('p-result', res);
}

async function purchasePool() {
  const id = document.getElementById('p-id').value;
  const res = await api(`/pools/${id}/purchase`, { method: 'PATCH' });
  showResult('p-result', res);
}

async function deliverPool() {
  const id = document.getElementById('p-id').value;
  const res = await api(`/pools/${id}/deliver`, { method: 'PATCH' });
  showResult('p-result', res);
}

async function deletePool() {
  const id = document.getElementById('p-id').value;
  const res = await api(`/pools/${id}`, { method: 'DELETE' });
  showResult('p-result', res);
}

// ── Contributions ──
function generateIdempotencyKey() {
  return 'key-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

async function createContribution() {
  const idempotencyInput = document.getElementById('c-idempotency');
  let idempotencyKey = idempotencyInput.value;
  if (!idempotencyKey) {
    idempotencyKey = generateIdempotencyKey();
    idempotencyInput.value = idempotencyKey;
  }

  const res = await api('/contributions', {
    method: 'POST',
    body: JSON.stringify({
      poolId: parseInt(document.getElementById('c-pool-id').value),
      originalAmount: parseFloat(document.getElementById('c-amount').value),
      originalCurrency: document.getElementById('c-currency').value,
      idempotencyKey,
    }),
  });
  showResult('c-create-result', res);
}

async function getMyContributions() {
  const res = await api('/contributions/my');
  showRaw('c-my-result', res);
}

async function getPoolContributions() {
  const id = document.getElementById('c-pool-filter').value;
  const res = await api(`/contributions/pool/${id}`);
  showRaw('c-pool-result', res);
}

// ── Family Tree ──
async function getFamilyTree() {
  const id = document.getElementById('ft-wedding').value;
  const res = await api(`/family/${id}/tree`);
  showRaw('ft-tree-result', res);
}

async function getGiftObligations() {
  const id = document.getElementById('ft-ob-wedding').value;
  const res = await api(`/family/${id}/obligations`);
  showRaw('ft-ob-result', res);
}

async function addFamilyMember() {
  const res = await api(`/family/${document.getElementById('ft-add-wedding').value}/member`, {
    method: 'POST',
    body: JSON.stringify({
      memberId: parseInt(document.getElementById('ft-member-id').value),
      ancestorId: document.getElementById('ft-ancestor-id').value ? parseInt(document.getElementById('ft-ancestor-id').value) : null,
      giftObligation: document.getElementById('ft-obligation').value ? parseInt(document.getElementById('ft-obligation').value) : null,
    }),
  });
  showResult('ft-add-result', res);
}

async function removeFamilyMember() {
  const weddingId = document.getElementById('ft-rm-wedding').value;
  const memberId = document.getElementById('ft-rm-member').value;
  const res = await api(`/family/${weddingId}/member/${memberId}`, { method: 'DELETE' });
  showResult('ft-rm-result', res);
}

async function sendObligationReminders() {
  const id = document.getElementById('ft-rm-wedding').value;
  const res = await api(`/family/${id}/remind`, { method: 'POST' });
  showResult('ft-rm-result', res);
}

// ── Admin ──
async function listUsers() {
  const res = await api('/admin/users');
  showRaw('admin-users-result', res);
}

async function deleteUser() {
  const id = document.getElementById('admin-del-user').value;
  const res = await api(`/admin/users/${id}`, { method: 'DELETE' });
  showResult('admin-del-result', res);
}

async function updateExchangeRate() {
  const res = await api('/admin/exchange-rates', {
    method: 'PUT',
    body: JSON.stringify({
      currencyFrom: document.getElementById('admin-rate-from').value,
      currencyTo: document.getElementById('admin-rate-to').value,
      rate: parseFloat(document.getElementById('admin-rate').value),
    }),
  });
  showResult('admin-rate-result', res);
}

async function getAuditLog() {
  const res = await api('/admin/audit-log');
  showRaw('admin-audit-result', res);
}

async function promoteModerator() {
  const id = document.getElementById('admin-promote').value;
  const res = await api(`/admin/moderators/${id}/promote`, { method: 'PATCH' });
  showResult('admin-promote-result', res);
}

async function getQueueStats() {
  const res = await api('/admin/queue-stats');
  showRaw('admin-queue-result', res);
}

// ── Moderator ──
async function getFlaggedContributions() {
  const res = await api('/moderator/contributions/flagged');
  showRaw('mod-flagged-result', res);
}

async function blockUser() {
  const id = document.getElementById('mod-block').value;
  const res = await api(`/moderator/users/${id}/block`, { method: 'PATCH' });
  showResult('mod-block-result', res);
}

async function getOwnAuditLog() {
  const res = await api('/moderator/audit-log');
  showRaw('mod-audit-result', res);
}

// ── Health ──
async function healthCheck() {
  const res = await api('/health');
  showResult('health-result', res);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Auth buttons
  document.getElementById('btn-register')?.addEventListener('click', register);
  document.getElementById('btn-login')?.addEventListener('click', login);
  document.getElementById('btn-verify')?.addEventListener('click', verifyEmail);
  document.getElementById('btn-refresh')?.addEventListener('click', refreshToken);
    document.getElementById('btn-get-me')?.addEventListener('click', getMe);
  document.getElementById('btn-forgot')?.addEventListener('click', forgotPassword);
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Wedding buttons
  document.getElementById('btn-create-wedding')?.addEventListener('click', createWedding);
  document.getElementById('btn-list-weddings')?.addEventListener('click', listWeddings);
  document.getElementById('btn-get-wedding')?.addEventListener('click', getWedding);
  document.getElementById('btn-delete-wedding')?.addEventListener('click', deleteWedding);

  // Pool buttons
  document.getElementById('btn-create-pool')?.addEventListener('click', createPool);
  document.getElementById('btn-list-pools')?.addEventListener('click', listPools);
  document.getElementById('btn-get-pool')?.addEventListener('click', getPool);
  document.getElementById('btn-update-pool-status')?.addEventListener('click', updatePoolStatus);
  document.getElementById('btn-purchase-pool')?.addEventListener('click', purchasePool);
  document.getElementById('btn-deliver-pool')?.addEventListener('click', deliverPool);
  document.getElementById('btn-delete-pool')?.addEventListener('click', deletePool);

  // Contribution buttons
  document.getElementById('btn-create-contribution')?.addEventListener('click', createContribution);
  document.getElementById('btn-my-contributions')?.addEventListener('click', getMyContributions);
  document.getElementById('btn-pool-contributions')?.addEventListener('click', getPoolContributions);

  // Family buttons
  document.getElementById('btn-family-tree')?.addEventListener('click', getFamilyTree);
  document.getElementById('btn-gift-obligations')?.addEventListener('click', getGiftObligations);
  document.getElementById('btn-add-family')?.addEventListener('click', addFamilyMember);
  document.getElementById('btn-remove-family')?.addEventListener('click', removeFamilyMember);
  document.getElementById('btn-send-reminders')?.addEventListener('click', sendObligationReminders);

  // Admin buttons
  document.getElementById('btn-list-users')?.addEventListener('click', listUsers);
  document.getElementById('btn-delete-user')?.addEventListener('click', deleteUser);
  document.getElementById('btn-exchange-rate')?.addEventListener('click', updateExchangeRate);
  document.getElementById('btn-audit-log')?.addEventListener('click', getAuditLog);
  document.getElementById('btn-promote-mod')?.addEventListener('click', promoteModerator);
  document.getElementById('btn-queue-stats')?.addEventListener('click', getQueueStats);

  // Moderator buttons
  document.getElementById('btn-flagged')?.addEventListener('click', getFlaggedContributions);
  document.getElementById('btn-block-user')?.addEventListener('click', blockUser);
  document.getElementById('btn-own-audit')?.addEventListener('click', getOwnAuditLog);

  // Health button
  document.getElementById('btn-health')?.addEventListener('click', healthCheck);

  updateAuthUI();
});
