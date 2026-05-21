/**
 * Saukele Frontend Application
 * Handles page rendering, navigation, and user interactions.
 */

// ===== Utility Functions =====
function $(id) { return document.getElementById(id); }

function showToast(message, type = 'info') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} show`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatCurrency(amount, currency = 'KZT') {
  return new Intl.NumberFormat('kk-KZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getStatusBadge(status) {
  const map = {
    PENDING: 'badge--pending',
    FUNDING: 'badge--pending',
    FUNDED: 'badge--funded',
    PURCHASED: 'badge--purchased',
    DELIVERED: 'badge--delivered',
    COMPLETED: 'badge--completed',
    FAILED: 'badge--failed',
    REFUNDED: 'badge--pending',
    PREPARING: 'badge--pending',
    HANDED_TO_CARRIER: 'badge--pending',
    IN_TRANSIT: 'badge--pending',
    OUT_FOR_DELIVERY: 'badge--pending',
    ACTIVE: 'badge--active',
  };
  return `<span class="badge ${map[status] || 'badge--pending'}">${status}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
/**
 * Экранирует строку для безопасной вставки в атрибуты onclick (в одинарных кавычках).
 * Экранирует: ', \, \n, \r и другие управляющие символы
 */
function escapeJS(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
// ===== Navigation & Auth State =====
function updateAuthUI() {
  const loginBtn = $('loginBtn');
  const registerBtn = $('registerBtn');
  const userMenu = $('userMenu');
  const userName = $('userName');
  const adminLink = $('adminLink');
  const modLink = $('moderatorLink');

  if (api.isAuthenticated()) {
    const user = api.getCurrentUser();
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    userMenu.style.display = 'block';
    userName.textContent = user?.fullName || user?.email || 'User';

    if (user?.role === 'SUPER_ADMIN') {
      adminLink.style.display = 'block';
      modLink.style.display = 'block';
    } else if (user?.role === 'MODERATOR') {
      adminLink.style.display = 'none';
      modLink.style.display = 'block';
    } else {
      adminLink.style.display = 'none';
      modLink.style.display = 'none';
    }
  } else {
    loginBtn.style.display = '';
    registerBtn.style.display = '';
    userMenu.style.display = 'none';
  }
}

function showPage(page, params = null) {
  const content = $('pageContent');
  content.innerHTML = '<div class="loading">Loading</div>';
  content.className = 'page-section';

  const routes = {
    home: renderHome,
    login: renderLogin,
    register: renderRegister,
    verify: renderVerifyEmail,
    'forgot-password': renderForgotPassword,
    'reset-password': renderResetPassword,
    weddings: renderWeddings,
    pools: renderPools,
    family: renderFamily,
    profile: renderProfile,
    'my-contributions': renderMyContributions,
    'my-rank': renderMyRankPage,
    'admin-panel': renderAdminPanel,
    'moderator-panel': renderModeratorPanel,
  };

  const renderFn = routes[page];
  if (renderFn) {
    renderFn(content, params);
  } else {
    content.innerHTML = '<h2>Page not found</h2>';
  }

  // Close mobile menu
  document.querySelector('.nav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  document.querySelector('.nav').classList.toggle('open');
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  // Try to restore session
  if (api.isAuthenticated()) {
    try {
      const user = await api.getMe();
      api.setCurrentUser(user);
    } catch {
      api.clearTokens();
      api.clearCurrentUser();
    }
  }
  updateAuthUI();
  showPage('home');
});

// ==========================================
// HOME PAGE
// ==========================================
function renderHome(el) {
  el.innerHTML = `
    <section class="hero">
      <h1>Welcome to Saukele</h1>
      <p>A modern wedding gift management platform that preserves Kazakh traditions.
      Manage gift pools, family trees, contributions, and logistics — all in one place.</p>
      ${!api.isAuthenticated() ? `
      <div class="hero__actions">
        <a href="#" class="btn btn--primary" onclick="showPage('register')">Get Started</a>
        <a href="#" class="btn btn--secondary" onclick="showPage('login')">Sign In</a>
      </div>` : `
      <div class="hero__actions">
        <a href="#" class="btn btn--primary" onclick="showPage('weddings')">View Weddings</a>
        <a href="#" class="btn btn--secondary" onclick="showPage('pools')">Gift Pools</a>
      </div>`}
    </section>

    <section class="features">
      <div class="feature-card">
        <div class="feature-card__icon">💍</div>
        <h3>Wedding Management</h3>
        <p>Create and manage wedding events with detailed information and scheduling.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">🎁</div>
        <h3>Gift Pools</h3>
        <p>Set up gift pools with escrow-based funding. Track contributions in multiple currencies with locked exchange rates.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">🌳</div>
        <h3>Family Tree</h3>
        <p>Build your family hierarchy with traditional Kazakh kinship ranks and gift obligation tracking.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">💰</div>
        <h3>Contributions</h3>
        <p>Make secure contributions with idempotency support and real-time currency conversion.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">📦</div>
        <h3>Logistics</h3>
        <p>Track gift delivery from purchase to doorstep with fragile-item notifications.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">🔐</div>
        <h3>Role-Based Access</h3>
        <p>Granular permissions for Guests, Family Members, Couples, Moderators, and Admins.</p>
      </div>
    </section>
  `;
}

// ==========================================
// AUTH PAGES
// ==========================================

function renderLogin(el) {
  if (api.isAuthenticated()) {
    showPage('home');
    return;
  }
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>Welcome Back</h2>
        <p class="page-subtitle">Sign in to your Saukele account</p>
        <form id="loginForm">
          <div class="form-group">
            <label for="loginEmail">Email</label>
            <input type="email" id="loginEmail" required placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label for="loginPassword">Password</label>
            <input type="password" id="loginPassword" required placeholder="Your password">
          </div>
          <button type="submit" class="btn btn--primary btn--full">Sign In</button>
          <div class="auth-divider">or</div>
          <a href="#" class="btn btn--secondary btn--full" onclick="showPage('register')">Create Account</a>
          <p style="text-align:center;margin-top:16px;">
            <a href="#" onclick="showPage('forgot-password')" style="font-size:0.85rem;">Forgot password?</a>
          </p>
        </form>
        <div id="loginError" class="form-error" style="display:none;text-align:center;margin-top:16px;"></div>
      </div>
    </div>
  `;

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value;
    const password = $('loginPassword').value;
    const errorEl = $('loginError');
    const btn = e.target.querySelector('button[type="submit"]');

    try {
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      await api.login(email, password);
      const user = await api.getMe();
      api.setCurrentUser(user);
      updateAuthUI();
      showToast('Welcome back, ' + (user.fullName || user.email) + '!', 'success');
      showPage('home');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function renderRegister(el) {
  if (api.isAuthenticated()) {
    showPage('home');
    return;
  }
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>Create Account</h2>
        <p class="page-subtitle">Join Saukele and start managing wedding gifts</p>
        <form id="registerForm">
          <div class="form-group">
            <label for="regName">Full Name (optional)</label>
            <input type="text" id="regName" placeholder="Your name">
          </div>
          <div class="form-group">
            <label for="regEmail">Email *</label>
            <input type="email" id="regEmail" required placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label for="regPassword">Password *</label>
            <input type="password" id="regPassword" required placeholder="Min 8 characters" minlength="8">
          </div>
          <div class="form-group">
            <label for="regRole">Role</label>
            <select id="regRole">
              <option value="GUEST">Guest</option>
              <option value="FAMILY_MEMBER">Family Member</option>
              <option value="COUPLE">Couple</option>
            </select>
          </div>
          <button type="submit" class="btn btn--primary btn--full">Create Account</button>
          <div class="auth-divider">or</div>
          <a href="#" class="btn btn--secondary btn--full" onclick="showPage('login')">Sign In</a>
        </form>
        <div id="registerError" class="form-error" style="display:none;text-align:center;margin-top:16px;"></div>
        <div id="registerSuccess" class="form-success" style="display:none;text-align:center;margin-top:16px;"></div>
      </div>
    </div>
  `;

  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('regEmail').value;
    const password = $('regPassword').value;
    const role = $('regRole').value;
    const fullName = $('regName').value;
    const errorEl = $('registerError');
    const successEl = $('registerSuccess');
    const btn = e.target.querySelector('button[type="submit"]');

    try {
      btn.disabled = true;
      btn.textContent = 'Creating account...';
      const result = await api.register(email, password, role, fullName);
      successEl.textContent = result.message || 'Account created! Please check your email for verification code.';
      successEl.style.display = 'block';
      errorEl.style.display = 'none';
      showToast('Account created! Verify your email.', 'success');
      // Show verify page
      showPage('verify', email);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      successEl.style.display = 'none';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

function renderVerifyEmail(el, email) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>Verify Email</h2>
        <p class="page-subtitle">Enter the 6-digit code sent to ${escapeHtml(email || 'your email')}</p>
        <form id="verifyForm">
          <div class="form-group">
            <label for="verifyEmail">Email</label>
            <input type="email" id="verifyEmail" value="${escapeHtml(email || '')}" required>
          </div>
          <div class="form-group">
            <label for="verifyCode">Verification Code</label>
            <input type="text" id="verifyCode" required placeholder="6-digit code" maxlength="6">
          </div>
          <button type="submit" class="btn btn--primary btn--full">Verify Email</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="handleResendVerification()" style="font-size:0.85rem;">Resend code</a>
        </p>
        <div id="verifyError" class="form-error" style="display:none;text-align:center;margin-top:16px;"></div>
        <div id="verifySuccess" class="form-success" style="display:none;text-align:center;margin-top:16px;"></div>
      </div>
    </div>
  `;

  $('verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = $('verifyEmail').value;
    const code = $('verifyCode').value;
    const errorEl = $('verifyError');
    const successEl = $('verifySuccess');

    try {
      await api.verifyEmail(em, code);
      successEl.textContent = 'Email verified! You can now log in.';
      successEl.style.display = 'block';
      errorEl.style.display = 'none';
      showToast('Email verified successfully!', 'success');
      setTimeout(() => showPage('login'), 1500);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
}

async function handleResendVerification() {
  const email = $('verifyEmail')?.value;
  if (!email) return showToast('Enter your email first', 'error');
  try {
    await api.resendVerification(email);
    showToast('Verification code resent!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderForgotPassword(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>Forgot Password</h2>
        <p class="page-subtitle">Enter your email and we'll send a reset link</p>
        <form id="forgotForm">
          <div class="form-group">
            <label for="forgotEmail">Email</label>
            <input type="email" id="forgotEmail" required placeholder="your@email.com">
          </div>
          <button type="submit" class="btn btn--primary btn--full">Send Reset Link</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="showPage('login')" style="font-size:0.85rem;">Back to login</a>
        </p>
        <div id="forgotSuccess" class="form-success" style="display:none;text-align:center;margin-top:16px;"></div>
      </div>
    </div>
  `;

  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('forgotEmail').value;
    const successEl = $('forgotSuccess');
    try {
      await api.forgotPassword(email);
      successEl.textContent = 'If this email exists, a reset link has been sent.';
      successEl.style.display = 'block';
      showToast('Check your email for reset link', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderResetPassword(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>Reset Password</h2>
        <p class="page-subtitle">Enter your email, token, and new password</p>
        <form id="resetForm">
          <div class="form-group">
            <label for="resetEmail">Email</label>
            <input type="email" id="resetEmail" required placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label for="resetToken">Reset Token</label>
            <input type="text" id="resetToken" required placeholder="Token from email">
          </div>
          <div class="form-group">
            <label for="resetPassword">New Password</label>
            <input type="password" id="resetPassword" required placeholder="Min 8 characters" minlength="8">
          </div>
          <button type="submit" class="btn btn--primary btn--full">Reset Password</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="showPage('login')" style="font-size:0.85rem;">Back to login</a>
        </p>
        <div id="resetError" class="form-error" style="display:none;text-align:center;margin-top:16px;"></div>
      </div>
    </div>
  `;

  $('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('resetEmail').value;
    const token = $('resetToken').value;
    const newPassword = $('resetPassword').value;
    const errorEl = $('resetError');

    try {
      await api.resetPassword(email, token, newPassword);
      showToast('Password reset! You can now log in.', 'success');
      setTimeout(() => showPage('login'), 1500);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
}

async function handleLogout() {
  await api.logout();
  updateAuthUI();
  showToast('Logged out successfully', 'info');
  showPage('home');
}

// ==========================================
// WEDDINGS
// ==========================================

function renderWeddings(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();
  const canCreate = user?.role === 'COUPLE' || user?.role === 'SUPER_ADMIN';

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="page-title">Weddings</h2>
        <p class="page-subtitle">Browse and manage wedding events</p>
      </div>
      ${canCreate ? '<button class="btn btn--primary" onclick="showCreateWedding()">+ New Wedding</button>' : ''}
    </div>
    <div id="weddingList"><div class="loading">Loading</div></div>
    <div id="weddingPagination" class="flex-center" style="justify-content:center;margin-top:20px;"></div>
  `;

  loadWeddings();
}

let weddingCursor = null;

async function loadWeddings(direction = 'next') {
  const listEl = $('weddingList');
  if (!listEl) return;

  try {
    const result = await api.listWeddings(weddingCursor, 10);
    const data = result.data || result;

    if (!data.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">💍</div>
        <h3>No weddings yet</h3>
        <p>Create the first wedding to get started.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = `<div class="grid grid--2">${data.map(w => `
      <div class="card" onclick="showWeddingDetail(${w.id})" style="cursor:pointer;">
        <div class="card__header">
          <h3 class="card__title">${escapeHtml(w.title)}</h3>
          ${getStatusBadge('ACTIVE')}
        </div>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:8px;">
          📅 ${formatDate(w.date)}
        </p>
        ${w.location ? `<p style="color:var(--text-secondary);font-size:0.9rem;">📍 ${escapeHtml(w.location)}</p>` : ''}
        <p style="color:var(--text-light);font-size:0.85rem;margin-top:8px;">
          Couple ID: ${w.coupleId} • Pools: ${w.giftPools?.length || 0}
        </p>
      </div>
    `).join('')}</div>`;

    // Pagination
    const pag = $('weddingPagination');
    const pagination = result.pagination;
    if (pagination) {
      pag.innerHTML = `
        ${pagination.nextCursor ? `<button class="btn btn--secondary btn--sm" onclick="loadMoreWeddings(${pagination.nextCursor})">Load More</button>` : ''}
      `;
      weddingCursor = pagination.nextCursor;
    }
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadMoreWeddings(cursor) {
  weddingCursor = cursor;
  await loadWeddings();
}

function showCreateWedding() {
  showModal(`
    <h3>Create New Wedding</h3>
    <form id="createWeddingForm">
      <div class="form-group">
        <label for="wedTitle">Title *</label>
        <input type="text" id="wedTitle" required placeholder="e.g., Ainur & Bekzat">
      </div>
      <div class="form-group">
        <label for="wedDate">Date *</label>
        <input type="datetime-local" id="wedDate" required>
      </div>
      <div class="form-group">
        <label for="wedLocation">Location</label>
        <input type="text" id="wedLocation" placeholder="e.g., Almaty, Kazakhstan">
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Create Wedding</button>
      </div>
    </form>
  `);

  $('createWeddingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('wedTitle').value;
    const date = new Date($('wedDate').value).toISOString();
    const location = $('wedLocation').value;

    try {
      await api.createWedding({ title, date, location });
      closeModal();
      showToast('Wedding created!', 'success');
      showPage('weddings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function showWeddingDetail(id) {
  showModal(`<div class="loading">Loading wedding details...</div>`);
  try {
    const w = await api.getWedding(id);
    const user = api.getCurrentUser();
    const canEdit = (user?.role === 'COUPLE' && w.isMyWedding) || user?.role === 'SUPER_ADMIN';
    const canDelete = (user?.role === 'COUPLE' && w.isMyWedding) || user?.role === 'SUPER_ADMIN';

    showModal(`
      <h3>${escapeHtml(w.title)}</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px;">
        📅 ${formatDate(w.date)}<br>
        ${w.location ? `📍 ${escapeHtml(w.location)}` : ''}
      </p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">${w.giftPools?.length || 0}</div>
          <div class="stat-card__label">Gift Pools</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${w.familyTree?.length || 0}</div>
          <div class="stat-card__label">Family Members</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn--secondary btn--sm" onclick="closeModal();showPage('family', ${id})">🌳 Family Tree</button>
        <button class="btn btn--secondary btn--sm" onclick="closeModal();showPage('pools', ${id})">🎁 Gift Pools</button>
                ${canEdit ? `<button class="btn btn--accent btn--sm" onclick="closeModal();editWedding(${id}, '${escapeJS(w.title)}', '${escapeJS(w.date)}', '${escapeJS(w.location || '')}')">✏️ Edit</button>` : ''}
        ${canDelete ? `<button class="btn btn--danger btn--sm" onclick="closeModal();deleteWedding(${id})">🗑 Delete</button>` : ''}
      </div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

async function editWedding(id, title, date, location) {
  showModal(`
    <h3>Edit Wedding</h3>
    <form id="editWeddingForm">
      <div class="form-group">
        <label>Title *</label>
        <input type="text" id="editWedTitle" value="${escapeHtml(title)}" required>
      </div>
      <div class="form-group">
        <label>Date *</label>
        <input type="datetime-local" id="editWedDate" value="${date ? date.slice(0, 16) : ''}" required>
      </div>
      <div class="form-group">
        <label>Location</label>
        <input type="text" id="editWedLocation" value="${escapeHtml(location)}">
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Save</button>
      </div>
    </form>
  `);

  $('editWeddingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updateWedding(id, {
        title: $('editWedTitle').value,
        date: $('editWedDate').value ? new Date($('editWedDate').value).toISOString() : undefined,
        location: $('editWedLocation').value,
      });
      closeModal();
      showToast('Wedding updated!', 'success');
      showPage('weddings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function deleteWedding(id) {
  if (!confirm('Are you sure you want to delete this wedding?')) return;
  try {
    await api.deleteWedding(id);
    showToast('Wedding deleted', 'success');
    showPage('weddings');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// GIFT POOLS
// ==========================================

function renderPools(el, weddingId) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();
  const canCreate = user?.role === 'COUPLE' || user?.role === 'SUPER_ADMIN';

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="page-title">Gift Pools</h2>
        <p class="page-subtitle">${weddingId ? `Gift pools for wedding #${weddingId}` : 'All gift pools'}</p>
      </div>
      ${canCreate ? '<button class="btn btn--primary" onclick="showCreatePool()">+ New Pool</button>' : ''}
    </div>
    <div id="poolList"><div class="loading">Loading</div></div>
  `;

  loadPools(weddingId);
}

let poolCursor = null;

async function loadPools(weddingId = null) {
  const listEl = $('poolList');
  if (!listEl) return;

  try {
    const result = await api.listPools(weddingId, null, 20);
    const data = result.data || result;

    if (!data.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🎁</div>
        <h3>No gift pools yet</h3>
        <p>Create a gift pool for guests to contribute to.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = `<div class="grid grid--2">${data.map(p => {
      const progress = p.targetKzt > 0 ? Math.min(100, Math.round((p.totalFunded / p.targetKzt) * 100)) : 0;
      return `
      <div class="card" onclick="showPoolDetail(${p.id})" style="cursor:pointer;">
        <div class="card__header">
          <h3 class="card__title">${escapeHtml(p.name)}</h3>
          ${getStatusBadge(p.status)}
        </div>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:12px;">
          ${escapeHtml(p.description || 'No description')}
        </p>
        <div style="margin-bottom:8px;">
          <div class="flex-between" style="font-size:0.85rem;">
            <span>${formatCurrency(p.totalFunded)} raised</span>
            <span>${formatCurrency(p.targetKzt)} goal</span>
          </div>
          <div class="progress-bar" style="margin-top:6px;">
            <div class="progress-bar__fill" style="width:${progress}%"></div>
          </div>
          <p style="font-size:0.85rem;color:var(--text-light);text-align:right;margin-top:4px;">${progress}%</p>
        </div>
        <p style="color:var(--text-light);font-size:0.8rem;">
          ${p.privacy || 'PUBLIC'} • Wedding #${p.weddingId} ${p.isFragile ? '• 📦 Fragile' : ''}
        </p>
      </div>`;
    }).join('')}</div>`;

    const pag = result.pagination;
    poolCursor = pag?.nextCursor;
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

function showCreatePool() {
  showModal(`
    <h3>Create Gift Pool</h3>
    <form id="createPoolForm">
      <div class="form-group">
        <label for="poolWeddingId">Wedding ID *</label>
        <input type="number" id="poolWeddingId" required placeholder="Wedding ID">
      </div>
      <div class="form-group">
        <label for="poolName">Pool Name *</label>
        <input type="text" id="poolName" required placeholder="e.g., Kitchen Set">
      </div>
      <div class="form-group">
        <label for="poolDesc">Description</label>
        <textarea id="poolDesc" placeholder="Describe the gift..."></textarea>
      </div>
      <div class="form-group">
        <label for="poolTarget">Target Amount (KZT) *</label>
        <input type="number" id="poolTarget" required placeholder="500000">
      </div>
      <div class="form-group">
        <label for="poolPrivacy">Privacy</label>
        <select id="poolPrivacy">
          <option value="PUBLIC">Public</option>
          <option value="FAMILY_ONLY">Family Only</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="poolFragile"> Is this a fragile item?
        </label>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Create Pool</button>
      </div>
    </form>
  `);

  $('createPoolForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createPool({
        weddingId: parseInt($('poolWeddingId').value),
        name: $('poolName').value,
        description: $('poolDesc').value,
        targetKzt: parseInt($('poolTarget').value),
        privacy: $('poolPrivacy').value,
        isFragile: $('poolFragile').checked,
      });
      closeModal();
      showToast('Gift pool created!', 'success');
      showPage('pools');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function showPoolDetail(id) {
  showModal(`<div class="loading">Loading pool details...</div>`);
  try {
    const p = await api.getPool(id);
    const user = api.getCurrentUser();
    const isCoupleOrAdmin = user?.role === 'COUPLE' || user?.role === 'SUPER_ADMIN';
    const progress = p.targetKzt > 0 ? Math.min(100, Math.round((p.totalFunded / p.targetKzt) * 100)) : 0;

        showModal(`
      <h3>${escapeHtml(p.name)}</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px;">
        ${escapeHtml(p.description || '')}<br>
        Status: ${getStatusBadge(p.status)} • Privacy: ${p.privacy} ${p.isFragile ? '• 📦 Fragile' : ''}
      </p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(p.totalFunded)}</div>
          <div class="stat-card__label">Raised</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(p.targetKzt)}</div>
          <div class="stat-card__label">Goal</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${progress}%</div>
          <div class="stat-card__label">Funded</div>
        </div>
      </div>
      <div class="progress-bar" style="margin-bottom:16px;">
        <div class="progress-bar__fill" style="width:${progress}%"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn--primary btn--sm" onclick="closeModal();showContributeToPool(${p.id})">💰 Contribute</button>
        <button class="btn btn--secondary btn--sm" onclick="closeModal();showPoolContributions(${p.id})">📋 View Contributions</button>
        ${p.status === 'FUNDED' && isCoupleOrAdmin ? `<button class="btn btn--accent btn--sm" onclick="handlePurchasePool(${p.id})">🛒 Mark Purchased</button>` : ''}
        ${p.status === 'PURCHASED' && isCoupleOrAdmin ? `
          <button class="btn btn--accent btn--sm" onclick="handleDeliverPool(${p.id})">📦 Mark Delivered</button>
          <button class="btn btn--secondary btn--sm" onclick="closeModal();showCreateLogistics(${p.id})">🚚 Logistics</button>` : ''}
        ${(p.status === 'PENDING' || p.status === 'FUNDING') && isCoupleOrAdmin ? `
          <button class="btn btn--secondary btn--sm" onclick="showUpdatePoolStatus(${p.id}, '${p.status}')">🔄 Update Status</button>
          <button class="btn btn--danger btn--sm" onclick="handleDeletePool(${p.id})">🗑 Delete</button>` : ''}
        ${p.status === 'PURCHASED' || p.status === 'DELIVERED' ? `<button class="btn btn--secondary btn--sm" onclick="closeModal();showLogistics(${p.id})">🚚 View Logistics</button>` : ''}
      </div>
      <div style="margin-top:12px;font-size:0.8rem;color:var(--text-light);">
        Wedding #${p.weddingId} • Created ${formatDateTime(p.createdAt)}
      </div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

async function showContributeToPool(poolId) {
  showModal(`
    <h3>Make a Contribution</h3>
    <form id="contributionForm">
      <div class="form-group">
        <label for="contribPoolId">Pool ID</label>
        <input type="number" id="contribPoolId" value="${poolId}" readonly>
      </div>
      <div class="form-group">
        <label for="contribAmount">Amount *</label>
        <input type="number" id="contribAmount" required step="0.01" placeholder="100">
      </div>
      <div class="form-group">
        <label for="contribCurrency">Currency *</label>
        <select id="contribCurrency">
          <option value="KZT">KZT (₸)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="RUB">RUB (₽)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="contribKey">Idempotency Key *</label>
        <input type="text" id="contribKey" required placeholder="unique-key-123" value="contrib-${Date.now()}">
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Contribute</button>
      </div>
    </form>
  `);

  $('contributionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const result = await api.createContribution({
        poolId: parseInt($('contribPoolId').value),
        originalAmount: parseFloat($('contribAmount').value),
        originalCurrency: $('contribCurrency').value,
        idempotencyKey: $('contribKey').value,
      });
      closeModal();
      showToast(`Contribution of ${result.amountKzt} KZT recorded! Rate locked at ${result.exchangeRate}`, 'success');
      showPage('my-contributions');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function showPoolContributions(poolId) {
  showModal(`<div class="loading">Loading contributions...</div>`);
  try {
    const result = await api.getPoolContributions(poolId, null, 50);
    const data = result.data || result;

    if (!data.length) {
      showModal(`
        <h3>Contributions for Pool #${poolId}</h3>
        <div class="empty-state"><p>No contributions yet.</p></div>
        <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
      `);
      return;
    }

    showModal(`
      <h3>Contributions for Pool #${poolId}</h3>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount (KZT)</th>
              <th>Original</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(c => `
              <tr>
                <td>#${c.id}</td>
                <td>${formatCurrency(c.amountKzt)}</td>
                <td>${c.originalAmount} ${c.originalCurrency}</td>
                <td>${c.exchangeRate}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${formatDateTime(c.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

async function handlePurchasePool(id) {
  if (!confirm('Mark this pool as purchased?')) return;
  try {
    await api.purchasePool(id);
    showToast('Pool marked as purchased!', 'success');
    showPage('pools');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeliverPool(id) {
  if (!confirm('Mark this pool as delivered?')) return;
  try {
    await api.deliverPool(id);
    showToast('Pool marked as delivered!', 'success');
    showPage('pools');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeletePool(id) {
  if (!confirm('Are you sure you want to delete this pool?')) return;
  try {
    await api.deletePool(id);
    showToast('Pool deleted', 'success');
    showPage('pools');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showUpdatePoolStatus(id, currentStatus) {
  const statuses = ['PENDING', 'FUNDING', 'FUNDED', 'PURCHASED', 'DELIVERED'];
  const available = statuses.filter(s => s !== currentStatus);

  showModal(`
    <h3>Update Pool Status</h3>
    <p style="color:var(--text-secondary);margin-bottom:16px;">Current: ${getStatusBadge(currentStatus)}</p>
    <form id="updateStatusForm">
      <div class="form-group">
        <label for="newStatus">New Status</label>
        <select id="newStatus">
          ${available.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Update</button>
      </div>
    </form>
  `);

  $('updateStatusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updatePoolStatus(id, $('newStatus').value);
      closeModal();
      showToast('Pool status updated!', 'success');
      showPage('pools');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==========================================
// LOGISTICS
// ==========================================

async function showCreateLogistics(poolId) {
  try {
    await api.createLogistics(poolId);
    showToast('Logistics tracking created!', 'success');
    showLogistics(poolId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showLogistics(poolId) {
  showModal(`<div class="loading">Loading logistics...</div>`);
  try {
    const log = await api.getLogistics(poolId);
    const user = api.getCurrentUser();
    const canEdit = user?.role === 'COUPLE' || user?.role === 'SUPER_ADMIN';

    showModal(`
      <h3>Logistics — Pool #${poolId}</h3>
      <div style="margin-bottom:16px;">
        <p>Status: ${getStatusBadge(log.deliveryStatus)}</p>
        ${log.carrierName ? `<p>Carrier: ${escapeHtml(log.carrierName)}</p>` : ''}
        ${log.trackingNumber ? `<p>Tracking: ${escapeHtml(log.trackingNumber)}</p>` : ''}
        ${log.fragileWarningSent ? '<p>📦 Fragile warning sent to carrier</p>' : ''}
        ${log.estimatedDelivery ? `<p>Estimated: ${formatDate(log.estimatedDelivery)}</p>` : ''}
        ${log.deliveredAt ? `<p>Delivered: ${formatDateTime(log.deliveredAt)}</p>` : ''}
      </div>
      ${canEdit && log.deliveryStatus !== 'DELIVERED' && log.deliveryStatus !== 'FAILED' ? `
        <button class="btn btn--accent btn--sm" onclick="closeModal();showAssignCarrier(${poolId})">🚚 Assign Carrier</button>
        <button class="btn btn--secondary btn--sm" onclick="closeModal();showUpdateDeliveryStatus(${poolId}, '${log.deliveryStatus}')">🔄 Update Status</button>
      ` : ''}
      <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p>
      <div class="modal__actions">
        <button class="btn btn--primary" onclick="closeModal();showCreateLogistics(${poolId})">Initialize Logistics</button>
        <button class="btn btn--secondary" onclick="closeModal()">Close</button>
      </div>`);
  }
}

function showAssignCarrier(poolId) {
  showModal(`
    <h3>Assign Carrier</h3>
    <form id="assignCarrierForm">
      <div class="form-group">
        <label for="carrierName">Carrier Name *</label>
        <input type="text" id="carrierName" required placeholder="e.g., KazPost">
      </div>
      <div class="form-group">
        <label for="trackingNumber">Tracking Number *</label>
        <input type="text" id="trackingNumber" required placeholder="KZ1234567890">
      </div>
      <div class="form-group">
        <label for="estDelivery">Estimated Delivery</label>
        <input type="datetime-local" id="estDelivery">
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Assign</button>
      </div>
    </form>
  `);

  $('assignCarrierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.assignCarrier(poolId, {
        carrierName: $('carrierName').value,
        trackingNumber: $('trackingNumber').value,
        estimatedDelivery: $('estDelivery').value ? new Date($('estDelivery').value).toISOString() : undefined,
      });
      closeModal();
      showToast('Carrier assigned!', 'success');
      showLogistics(poolId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showUpdateDeliveryStatus(poolId, currentStatus) {
  const statuses = ['PREPARING', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
  const available = statuses.filter(s => s !== currentStatus);

  showModal(`
    <h3>Update Delivery Status</h3>
    <p style="color:var(--text-secondary);margin-bottom:16px;">Current: ${getStatusBadge(currentStatus)}</p>
    <form id="updateDeliveryForm">
      <div class="form-group">
        <label for="deliveryStatus">New Status</label>
        <select id="deliveryStatus">
          ${available.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="carrierNotes">Carrier Notes</label>
        <textarea id="carrierNotes" placeholder="Any notes..."></textarea>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Update</button>
      </div>
    </form>
  `);

  $('updateDeliveryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updateDeliveryStatus(poolId, $('deliveryStatus').value, $('carrierNotes').value);
      closeModal();
      showToast('Delivery status updated!', 'success');
      showLogistics(poolId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
// ==========================================
// FAMILY TREE
// ==========================================

function renderFamily(el, weddingId) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();
  const isCoupleOrAdmin = user?.role === 'COUPLE' || user?.role === 'SUPER_ADMIN';

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="page-title">Family Tree</h2>
        <p class="page-subtitle">View and manage wedding family hierarchies</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${isCoupleOrAdmin ? '<button class="btn btn--primary btn--sm" onclick="showAddFamilyMember()">+ Add Member</button>' : ''}
        <button class="btn btn--secondary btn--sm" onclick="showMyFamilyWedding()">👤 My Wedding</button>
        <button class="btn btn--secondary btn--sm" onclick="showMyRank()">🏅 My Rank</button>
      </div>
    </div>
    <div class="form-group" style="max-width:300px;">
      <label for="familyWeddingId">Wedding ID</label>
      <input type="number" id="familyWeddingId" value="${weddingId || ''}" placeholder="Enter Wedding ID">
    </div>
    <button class="btn btn--secondary btn--sm" onclick="loadFamilyTree()">🔍 Load Family Tree</button>
    <div id="familyTreeContent" style="margin-top:20px;"></div>
  `;

  if (weddingId) loadFamilyTree();
}

async function loadFamilyTree() {
  const weddingId = $('familyWeddingId')?.value;
  const content = $('familyTreeContent');
  if (!weddingId) return showToast('Enter a Wedding ID', 'error');
  if (!content) return;

  content.innerHTML = '<div class="loading">Loading family tree...</div>';

  try {
    const result = await api.getFamilyTreeRecursive(parseInt(weddingId), null, true);
    const levels = result.levels || [];

    if (!levels.length) {
      content.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🌳</div>
        <h3>No family members yet</h3>
        <p>Add family members to build the tree.</p>
      </div>`;
      return;
    }

    // Also load obligations
    let obligationsHtml = '';
    try {
      const obligations = await api.getGiftObligations(parseInt(weddingId));
      if (obligations.length) {
        obligationsHtml = `
          <div class="card" style="margin-bottom:20px;">
            <h3 style="font-family:var(--font-heading);margin-bottom:12px;">Gift Obligations</h3>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Minimum Obligation</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  ${obligations.map(o => `
                    <tr>
                      <td>${o.rank}</td>
                      <td>${formatCurrency(o.minimumObligation)}</td>
                      <td>${o.count}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } catch { /* ignore */ }

    content.innerHTML = `
      ${obligationsHtml}
      <div class="card">
        <h3 style="font-family:var(--font-heading);margin-bottom:16px;">Family Tree Hierarchy</h3>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px;">
          Wedding #${result.weddingId} • Query: ${result.queryType}
        </p>
        ${levels.map(level => `
          <div class="tree-level">
            <div class="tree-level__title">Level ${level.level}</div>
            <div class="tree-members">
              ${(level.members || []).map(m => `
                <div class="tree-member">
                  ${escapeHtml(m.fullName || `User #${m.memberId}`)}
                  <span class="tree-member__rank">${m.kinshipRank}</span>
                  ${m.giftObligation ? `<span style="font-size:0.75rem;color:var(--accent-dark);">${formatCurrency(m.giftObligation)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

function showAddFamilyMember() {
  showModal(`
    <h3>Add Family Member</h3>
    <form id="addFamilyMemberForm">
      <div class="form-group">
        <label for="famWeddingId">Wedding ID *</label>
        <input type="number" id="famWeddingId" required placeholder="Wedding ID">
      </div>
      <div class="form-group">
        <label for="famSearchEmail">User email *</label>
        <div style="display:flex;gap:8px;">
          <input type="email" id="famSearchEmail" required placeholder="user@email.com" style="flex:1;">
          <button type="button" class="btn btn--primary btn--sm" onclick="handleSearchUser()">Find</button>
        </div>
        <div id="famSearchResult" style="display:none;margin-top:8px;"></div>
        <input type="hidden" id="famMemberId">
      </div>
      <div class="form-group">
        <label for="famRank">Kinship Rank *</label>
        <select id="famRank" required>
          <option value="ATA_ANA">Ata-Ana (Parents) — 100,000 KZT</option>
          <option value="ZHIEN_ZHARAP">Zhien-Zharap (Relatives) — 50,000 KZT</option>
          <option value="SHAKYRT">Shakirt (Distant) — 20,000 KZT</option>
        </select>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn--primary">Add Member</button>
      </div>
    </form>
  `);

  $('addFamilyMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = parseInt($('famMemberId').value);
    if (!memberId) {
      showToast('Please find a user by email first', 'error');
      return;
    }
    try {
      await api.addFamilyMember(parseInt($('famWeddingId').value), {
        memberId: memberId,
        ancestorId: null,
        kinshipRank: $('famRank').value,
        giftObligation: null,
      });
      closeModal();
      showToast('Family member added!', 'success');
      showPage('family');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function handleSearchUser() {
  const email = $('famSearchEmail')?.value;
  const resultEl = $('famSearchResult');
  if (!email || !resultEl) return;

  try {
    resultEl.innerHTML = '<p style="color:var(--text-secondary);">Searching...</p>';
    resultEl.style.display = 'block';
    const user = await api.searchUserByEmail(email);
    $('famMemberId').value = user.id;
    resultEl.innerHTML = `
      <div class="card" style="padding:12px;margin-top:4px;background:var(--bg-card);">
        <p><strong>Found:</strong> ${escapeHtml(user.fullName || 'N/A')} (${escapeHtml(user.email)})</p>
        <p>ID: <strong>${user.id}</strong> | Role: ${user.role}</p>
        <p style="color:var(--success);font-size:0.85rem;">✅ User selected — ready to add</p>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:#cc6666;">User not found: ${escapeHtml(err.message)}</p>`;
  }
}
async function showMyFamilyWedding() {
  showModal(`<div class="loading">Loading...</div>`);
  try {
    const data = await api.getMyFamilyWedding();
    showModal(`
      <h3>My Wedding</h3>
      <p><strong>${escapeHtml(data.title || '')}</strong></p>
      <p style="color:var(--text-secondary);">📅 ${data.date ? formatDate(data.date) : ''}</p>
      ${data.location ? `<p style="color:var(--text-secondary);">📍 ${escapeHtml(data.location)}</p>` : ''}
      ${data.giftPools?.length ? `
        <h4 style="margin-top:16px;">Gift Pools</h4>
        <ul style="padding-left:20px;">
          ${data.giftPools.map(p => `<li>${escapeHtml(p.name)} — ${getStatusBadge(p.status)}</li>`).join('')}
        </ul>
      ` : ''}
      <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

function renderMyRankPage(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  el.innerHTML = `
    <h2 class="page-title">My Rank & Obligations</h2>
    <p class="page-subtitle">View your kinship rank and gift obligations</p>
    <div id="myRankContent"><div class="loading">Loading</div></div>
  `;
  loadMyRankPage();
}

async function loadMyRankPage() {
  const content = $('myRankContent');
  if (!content) return;
  try {
    const data = await api.getMyRank();
    content.innerHTML = `
      <div class="stats-grid" style="max-width:600px;">
        <div class="stat-card">
          <div class="stat-card__value">${data.kinshipRank || 'N/A'}</div>
          <div class="stat-card__label">Rank</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(data.minimumObligation || 0)}</div>
          <div class="stat-card__label">Minimum Obligation</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(data.totalContributed || 0)}</div>
          <div class="stat-card__label">Contributed</div>
        </div>
      </div>
      <p style="text-align:center;margin-top:12px;font-size:1.1rem;">
        ${data.isFulfilled
          ? '<span style="color:var(--accent-dark);font-weight:600;">✅ Your obligation is fulfilled!</span>'
          : '<span style="color:#cc6666;font-weight:600;">❌ Obligation not yet fulfilled</span>'}
      </p>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function showMyRank() {
  showModal(`<div class="loading">Loading...</div>`);
  try {
    const data = await api.getMyRank();
    showModal(`
      <h3>My Rank & Obligations</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">${data.kinshipRank || 'N/A'}</div>
          <div class="stat-card__label">Rank</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(data.minimumObligation || 0)}</div>
          <div class="stat-card__label">Minimum Obligation</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(data.totalContributed || 0)}</div>
          <div class="stat-card__label">Contributed</div>
        </div>
      </div>
      <p style="text-align:center;margin-top:12px;">
        ${data.isFulfilled
          ? '<span style="color:var(--accent-dark);font-weight:600;">✅ Obligation fulfilled</span>'
          : '<span style="color:#cc6666;font-weight:600;">❌ Obligation not yet fulfilled</span>'}
      </p>
      <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

// ==========================================
// PROFILE
// ==========================================

function renderProfile(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();

  el.innerHTML = `
    <h2 class="page-title">My Profile</h2>
    <p class="page-subtitle">Manage your account details</p>
    <div class="card" style="max-width:500px;">
      <form id="profileForm">
        <div class="form-group">
          <label>Email</label>
          <input type="email" value="${escapeHtml(user?.email || '')}" disabled style="background:var(--bg-body);">
        </div>
        <div class="form-group">
          <label for="profileName">Full Name</label>
          <input type="text" id="profileName" value="${escapeHtml(user?.fullName || '')}" placeholder="Your full name">
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" value="${user?.role || ''}" disabled style="background:var(--bg-body);">
        </div>
        <div class="form-group">
          <label>Verified</label>
          <input type="text" value="${user?.emailVerified ? '✅ Yes' : '❌ No'}" disabled style="background:var(--bg-body);">
        </div>
        <button type="submit" class="btn btn--primary">Update Profile</button>
      </form>
    </div>
  `;

  $('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('profileName').value;
    try {
      const updated = await api.updateProfile({ firstName: name.split(' ')[0] || '', lastName: name.split(' ').slice(1).join(' ') || '' });
      api.setCurrentUser({ ...api.getCurrentUser(), fullName: updated.fullName || name });
      updateAuthUI();
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==========================================
// MY CONTRIBUTIONS
// ==========================================

function renderMyContributions(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }

  el.innerHTML = `
    <h2 class="page-title">My Contributions</h2>
    <p class="page-subtitle">View all your gift contributions</p>
    <div id="myContributionsList"><div class="loading">Loading</div></div>
  `;

  loadMyContributions();
}

async function loadMyContributions() {
  const listEl = $('myContributionsList');
  if (!listEl) return;

  try {
    const result = await api.getMyContributions(null, 50);
    const data = result.data || result;

    if (!data.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">💰</div>
        <h3>No contributions yet</h3>
        <p>Make your first contribution to a gift pool.</p>
        <button class="btn btn--primary btn--sm" style="margin-top:12px;" onclick="showPage('pools')">Browse Pools</button>
      </div>`;
      return;
    }

    const total = data.reduce((sum, c) => sum + c.amountKzt, 0);

    listEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">${data.length}</div>
          <div class="stat-card__label">Contributions</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatCurrency(total)}</div>
          <div class="stat-card__label">Total Contributed</div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pool</th>
              <th>Amount (KZT)</th>
              <th>Original</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(c => `
              <tr>
                <td>#${c.id}</td>
                <td>Pool #${c.poolId}</td>
                <td>${formatCurrency(c.amountKzt)}</td>
                <td>${c.originalAmount} ${c.originalCurrency}</td>
                <td>${c.exchangeRate}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${formatDateTime(c.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

// ==========================================
// ADMIN PANEL
// ==========================================

function renderAdminPanel(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();
  if (user?.role !== 'SUPER_ADMIN') {
    el.innerHTML = `<div class="empty-state"><h3>Access Denied</h3><p>Super Admin only.</p></div>`;
    return;
  }

  el.innerHTML = `
    <h2 class="page-title">Admin Panel</h2>
    <p class="page-subtitle">Manage users, exchange rates, and monitor the system</p>

    <div class="tabs">
      <button class="tab active" onclick="switchAdminTab(this, 'users')">Users</button>
      <button class="tab" onclick="switchAdminTab(this, 'exchange')">Exchange Rates</button>
      <button class="tab" onclick="switchAdminTab(this, 'audit')">Audit Log</button>
      <button class="tab" onclick="switchAdminTab(this, 'queue')">Queue Monitor</button>
      <button class="tab" onclick="switchAdminTab(this, 'moderators')">Moderators</button>
    </div>
    <div id="adminContent"><div class="loading">Loading users...</div></div>
  `;

  loadAdminUsers();
}

function switchAdminTab(tab, tabName) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const content = $('adminContent');

  switch (tabName) {
    case 'users': loadAdminUsers(); break;
    case 'exchange': renderAdminExchange(content); break;
    case 'audit': loadAdminAuditLog(); break;
    case 'queue': loadAdminQueueStats(); break;
    case 'moderators': loadAdminModerators(); break;
  }
}

async function loadAdminUsers() {
  const content = $('adminContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading users...</div>';

  try {
    const result = await api.adminListUsers(null, 50);
    const data = result.data || result;

    content.innerHTML = `
      <div class="section-header">
        <h2>Users (${data.length})</h2>
        <button class="btn btn--secondary btn--sm" onclick="loadAdminUsers()">🔄 Refresh</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Blocked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(u => `
              <tr>
                <td>#${u.id}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.fullName || '-')}</td>
                <td>${u.role}</td>
                <td>${u.emailVerified ? '✅' : '❌'}</td>
                <td>${u.isBlocked ? '🔴' : '🟢'}</td>
                <td>
                  <button class="btn btn--danger btn--sm" onclick="adminDeleteUser(${u.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
}

async function adminDeleteUser(id) {
  if (!confirm(`Delete user #${id}? This will anonymize their contributions.`)) return;
  try {
    await api.adminDeleteUser(id);
    showToast('User deleted', 'success');
    loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAdminExchange(content) {
  content.innerHTML = `
    <div class="card" style="max-width:500px;">
      <h3 style="font-family:var(--font-heading);margin-bottom:16px;">Set Exchange Rate</h3>
      <form id="exchangeRateForm">
        <div class="form-group">
          <label for="exFrom">From Currency</label>
          <select id="exFrom">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="RUB">RUB</option>
            <option value="KZT">KZT</option>
          </select>
        </div>
        <div class="form-group">
          <label for="exTo">To Currency</label>
          <select id="exTo">
            <option value="KZT" selected>KZT</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="RUB">RUB</option>
          </select>
        </div>
        <div class="form-group">
          <label for="exRate">Rate</label>
          <input type="number" id="exRate" step="0.01" required placeholder="e.g., 480.5">
        </div>
        <button type="submit" class="btn btn--primary">Update Rate</button>
      </form>
    </div>
  `;

  $('exchangeRateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.adminUpdateExchangeRate({
        currencyFrom: $('exFrom').value,
        currencyTo: $('exTo').value,
        rate: parseFloat($('exRate').value),
      });
      showToast('Exchange rate updated!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadAdminAuditLog() {
  const content = $('adminContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading audit log...</div>';

  try {
    const result = await api.adminGetAuditLog(null, 50);
    const data = result.data || result;

    if (!data.length) {
      content.innerHTML = `<div class="empty-state"><h3>No audit entries</h3></div>`;
      return;
    }

    content.innerHTML = `
      <div class="section-header">
        <h2>Audit Log</h2>
        <button class="btn btn--secondary btn--sm" onclick="loadAdminAuditLog()">🔄 Refresh</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(a => `
              <tr>
                <td>#${a.id}</td>
                <td>#${a.userId}</td>
                <td>${escapeHtml(a.action)}</td>
                <td>${a.entityType} #${a.entityId}</td>
                <td>${formatDateTime(a.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadAdminQueueStats() {
  const content = $('adminContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading queue stats...</div>';

  try {
    const stats = await api.adminGetQueueStats();
    const cronTasks = await api.adminGetCronTasks();

    content.innerHTML = `
      <div class="section-header">
        <h2>Queue Monitor</h2>
        <button class="btn btn--secondary btn--sm" onclick="loadAdminQueueStats()">🔄 Refresh</button>
        <a href="/admin/queues" target="_blank" class="btn btn--accent btn--sm" style="margin-left:8px;">📊 Bull Board</a>
      </div>
            <div class="grid grid--3">
        ${(Array.isArray(stats) ? stats : Object.values(stats || {})).map(info => `
          <div class="card" style="cursor:pointer;" onclick="showQueueDetail('${info.name}')">
            <h3 class="card__title">${info.name}</h3>
            <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-top:12px;">
              <div class="stat-card" style="padding:12px;">
                <div class="stat-card__value" style="font-size:1.5rem;">${info.waiting || 0}</div>
                <div class="stat-card__label">Waiting</div>
              </div>
              <div class="stat-card" style="padding:12px;">
                <div class="stat-card__value" style="font-size:1.5rem;">${info.active || 0}</div>
                <div class="stat-card__label">Active</div>
              </div>
              <div class="stat-card" style="padding:12px;">
                <div class="stat-card__value" style="font-size:1.5rem;">${info.completed || 0}</div>
                <div class="stat-card__label">Completed</div>
              </div>
              <div class="stat-card" style="padding:12px;">
                <div class="stat-card__value" style="font-size:1.5rem;color:#cc6666;">${info.failed || 0}</div>
                <div class="stat-card__label">Failed</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-top:24px;">
        <div class="section-header">
          <h3>🚀 Ручной запуск Cron-задач</h3>
          <button class="btn btn--secondary btn--sm" onclick="loadAdminQueueStats()">🔄 Refresh</button>
        </div>
        <p style="color:var(--text-light);margin-bottom:16px;">
          Запустите любую периодическую задачу немедленно, не дожидаясь расписания.
        </p>
        <div class="cron-tasks" style="display:grid;gap:12px;">
          ${(cronTasks || []).map(task => `
            <div class="cron-task" style="display:flex;align-items:center;justify-content:space-between;
              background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;">
              <div>
                <strong>${escapeHtml(task.label)}</strong>
                <p style="font-size:0.875rem;color:var(--text-light);margin:2px 0 0 0;">
                  ${escapeHtml(task.description)}
                  ${task.cron ? `<span style="margin-left:8px;opacity:0.7;">⏰ ${task.cron}</span>` : ''}
                </p>
              </div>
              <button class="btn btn--primary btn--sm" onclick="triggerCronTask('${task.type}')" id="cronBtn-${task.type}">
                ▶ Запустить
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
}

async function triggerCronTask(type) {
  const btn = $(`cronBtn-${type}`);
  if (!btn) return;
  const originalText = btn.textContent;
  btn.textContent = '⏳...';
  btn.disabled = true;

  try {
    const result = await api.adminTriggerCronTask(type);
    showToast(result.message || 'Задача запущена!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function showQueueDetail(queueName) {
  showModal(`<div class="loading">Loading queue details...</div>`);
  try {
    const detail = await api.adminGetQueueDetail(queueName);
    const jobs = detail.jobs || [];

    showModal(`
      <h3>Queue: ${queueName}</h3>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card__value">${detail.waiting || 0}</div><div class="stat-card__label">Waiting</div></div>
        <div class="stat-card"><div class="stat-card__value">${detail.active || 0}</div><div class="stat-card__label">Active</div></div>
        <div class="stat-card"><div class="stat-card__value">${detail.completed || 0}</div><div class="stat-card__label">Completed</div></div>
        <div class="stat-card"><div class="stat-card__value" style="color:#cc6666;">${detail.failed || 0}</div><div class="stat-card__label">Failed</div></div>
      </div>
      ${jobs.length ? `
        <div class="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Attempts</th><th>Actions</th></tr></thead>
            <tbody>
              ${jobs.map(j => `
                <tr>
                  <td>#${j.id}</td>
                  <td>${escapeHtml(j.name || '-')}</td>
                  <td>${j.attemptsMade || 0}</td>
                  <td>
                    <button class="btn btn--accent btn--sm" onclick="adminRetryJob('${queueName}', ${j.id})">Retry</button>
                    <button class="btn btn--danger btn--sm" onclick="adminRemoveJob('${queueName}', ${j.id})">Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="color:var(--text-light);margin-top:12px;">No recent jobs.</p>'}
      <div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>
    `);
  } catch (err) {
    showModal(`<p>Error: ${escapeHtml(err.message)}</p><div class="modal__actions"><button class="btn btn--secondary" onclick="closeModal()">Close</button></div>`);
  }
}

async function adminRetryJob(queueName, jobId) {
  try {
    await api.adminRetryJob(queueName, jobId);
    showToast('Job retried!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function adminRemoveJob(queueName, jobId) {
  try {
    await api.adminRemoveJob(queueName, jobId);
    showToast('Job removed', 'success');
    closeModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAdminModerators() {
  const content = $('adminContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading moderators...</div>';

  try {
    const result = await api.adminListUsers(null, 100, { role: 'MODERATOR' });
    // Also get all users to promote
    const allUsers = await api.adminListUsers(null, 100);
    const data = result.data || result;
    const allData = allUsers.data || allUsers;

    const nonModUsers = allData.filter(u => u.role !== 'MODERATOR' && u.role !== 'SUPER_ADMIN');

    content.innerHTML = `
      <div class="section-header">
        <h2>Moderators</h2>
      </div>
      <div class="card" style="margin-bottom:20px;">
        <h3 style="font-family:var(--font-heading);margin-bottom:12px;">Promote User to Moderator</h3>
        <div class="form-group">
          <select id="promoteUserId">
            ${nonModUsers.map(u => `<option value="${u.id}">#${u.id} - ${escapeHtml(u.email)} (${u.role})</option>`).join('')}
          </select>
        </div>
        <button class="btn btn--accent" onclick="adminPromoteModerator()">Toggle Moderator Role</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th></tr></thead>
          <tbody>
            ${data.map(u => `
              <tr>
                <td>#${u.id}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.fullName || '-')}</td>
                <td>${u.role}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
}

async function adminPromoteModerator() {
  const userId = parseInt($('promoteUserId')?.value);
  if (!userId) return showToast('Select a user', 'error');
  try {
    const result = await api.adminPromoteModerator(userId);
    showToast(result.message || 'Moderator role toggled!', 'success');
    loadAdminModerators();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// MODERATOR PANEL
// ==========================================

function renderModeratorPanel(el) {
  if (!api.isAuthenticated()) { showPage('login'); return; }
  const user = api.getCurrentUser();
  if (user?.role !== 'MODERATOR' && user?.role !== 'SUPER_ADMIN') {
    el.innerHTML = `<div class="empty-state"><h3>Access Denied</h3><p>Moderator or Admin only.</p></div>`;
    return;
  }

  el.innerHTML = `
    <h2 class="page-title">Moderator Panel</h2>
    <p class="page-subtitle">Manage flagged contributions and user blocks</p>
    <div class="tabs">
      <button class="tab active" onclick="switchModTab(this, 'flagged')">Flagged Contributions</button>
      <button class="tab" onclick="switchModTab(this, 'block')">Block Users</button>
      <button class="tab" onclick="switchModTab(this, 'audit')">My Audit Log</button>
    </div>
    <div id="modContent"><div class="loading">Loading flagged contributions...</div></div>
  `;

  loadModFlaggedContributions();
}

function switchModTab(tab, tabName) {
  document.querySelectorAll('#modContent ~ .tabs .tab, .tabs .tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const content = $('modContent');

  switch (tabName) {
    case 'flagged': loadModFlaggedContributions(); break;
    case 'block': renderModBlockUsers(content); break;
    case 'audit': loadModAuditLog(); break;
  }
}

async function loadModFlaggedContributions() {
  const content = $('modContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading flagged contributions...</div>';

  try {
    const result = await api.moderatorGetFlaggedContributions(null, 50);
    const data = result.data || result;

    if (!data.length) {
      content.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">✅</div>
        <h3>No flagged contributions</h3>
        <p>All contributions are in good standing.</p>
      </div>`;
      return;
    }

    content.innerHTML = `
      <div class="section-header">
        <h2>Flagged Contributions (${data.length})</h2>
        <button class="btn btn--secondary btn--sm" onclick="loadModFlaggedContributions()">🔄 Refresh</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pool</th>
              <th>Guest</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(c => `
              <tr>
                <td>#${c.id}</td>
                <td>Pool #${c.poolId}</td>
                <td>User #${c.guestId}</td>
                <td>${formatCurrency(c.amountKzt)}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${formatDateTime(c.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
}

function renderModBlockUsers(content) {
  content.innerHTML = `
    <div class="card" style="max-width:400px;">
      <h3 style="font-family:var(--font-heading);margin-bottom:16px;">Block / Unblock User</h3>
      <form id="blockUserForm">
        <div class="form-group">
          <label for="blockUserId">User ID</label>
          <input type="number" id="blockUserId" required placeholder="User ID">
        </div>
        <button type="submit" class="btn btn--danger">Toggle Block</button>
      </form>
    </div>
  `;

  $('blockUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const result = await api.moderatorBlockUser(parseInt($('blockUserId').value));
      showToast(result.message || 'Block status toggled!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadModAuditLog() {
  const content = $('modContent');
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading audit log...</div>';

  try {
    const result = await api.moderatorGetOwnAuditLog(null, 50);
    const data = result.data || result;

    if (!data.length) {
      content.innerHTML = `<div class="empty-state"><h3>No audit entries</h3></div>`;
      return;
    }

    content.innerHTML = `
      <div class="section-header">
        <h2>My Audit Log</h2>
        <button class="btn btn--secondary btn--sm" onclick="loadModAuditLog()">🔄 Refresh</button>
</div>
<div class="table-wrapper">
<table>
<thead>
<tr>
<th>ID</th>
<th>Action</th>
<th>Entity</th>
<th>Date</th>
</tr>
</thead>
<tbody>
${data.map(a => `
<tr>
<td>#${a.id}</td>
<td>${escapeHtml(a.action)}</td>
<td>${a.entityType} #${a.entityId}</td>
<td>${formatDateTime(a.createdAt)}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
`;
} catch (err) {
content.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
}
}

// ==========================================
// MODAL HELPERS
// ==========================================

let modalOverlay = null;

function showModal(html) {
closeModal();
modalOverlay = document.createElement('div');
modalOverlay.className = 'modal-overlay active';
modalOverlay.innerHTML = `<div class="modal">${html}</div>`;
modalOverlay.addEventListener('click', (e) => {
if (e.target === modalOverlay) closeModal();
});
document.body.appendChild(modalOverlay);
}

function closeModal() {
if (modalOverlay) {
modalOverlay.remove();
modalOverlay = null;
}
}