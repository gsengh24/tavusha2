/* ============================================================
   TAVUSHA — Customer Auth (Login / Signup) Module
   - Popup appears on: checkout attempt OR after 3 min idle
   - localStorage-based session (customer data)
   - No backend needed for customer login (Supabase optional)
   ============================================================ */
'use strict';

// ─── Helpers ──────────────────────────────────────────────────
const CUST_KEY = 'tavusha_customer';

function getCustSession() {
  try { return JSON.parse(localStorage.getItem(CUST_KEY)) || null; } catch { return null; }
}
function setCustSession(data) {
  localStorage.setItem(CUST_KEY, JSON.stringify(data));
}
function clearCustSession() {
  localStorage.removeItem(CUST_KEY);
}
function isLoggedIn() {
  const s = getCustSession();
  return !!(s && s.email && s.name);
}

// ─── Open / Close Auth Popup ──────────────────────────────────
let _authResolve = null; // callback when login completes

function openAuthPopup(afterLoginCallback) {
  if (isLoggedIn()) {
    if (typeof afterLoginCallback === 'function') afterLoginCallback();
    return;
  }
  _authResolve = afterLoginCallback || null;
  const overlay = document.getElementById('authPopupOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Default to login tab
  switchAuthTab('login');
  // Update nav
  updateAuthNav();
}

function closeAuthPopup() {
  const overlay = document.getElementById('authPopupOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  _authResolve = null;
  clearAuthErrors();
}

function switchAuthTab(tab) {
  document.getElementById('authLoginForm').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('authSignupForm').style.display = tab === 'signup' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  const activeTab = document.getElementById('authTab' + (tab === 'login' ? 'Login' : 'Signup'));
  if (activeTab) activeTab.classList.add('active');
  clearAuthErrors();
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(e => e.textContent = '');
}

// ─── Login Handler ────────────────────────────────────────────
function handleCustomerLogin(e) {
  e.preventDefault();
  clearAuthErrors();
  const email    = document.getElementById('authLoginEmail')?.value?.trim();
  const password = document.getElementById('authLoginPassword')?.value;
  const errEl    = document.getElementById('authLoginError');

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email.'; return; }

  // Check stored accounts
  const accounts = JSON.parse(localStorage.getItem('tavusha_accounts') || '[]');
  const account  = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

  if (!account) { errEl.textContent = 'No account found. Please sign up.'; return; }
  if (account.password !== btoa(password)) { errEl.textContent = 'Incorrect password.'; return; }

  setCustSession({ name: account.name, email: account.email, phone: account.phone || '' });
  onAuthSuccess(`Welcome back, ${account.name.split(' ')[0]}! 👋`);
}

// ─── Signup Handler ───────────────────────────────────────────
function handleCustomerSignup(e) {
  e.preventDefault();
  clearAuthErrors();
  const name     = document.getElementById('authSignupName')?.value?.trim();
  const email    = document.getElementById('authSignupEmail')?.value?.trim();
  const phone    = document.getElementById('authSignupPhone')?.value?.trim();
  const password = document.getElementById('authSignupPassword')?.value;
  const errEl    = document.getElementById('authSignupError');

  if (!name || !email || !password) { errEl.textContent = 'Please fill in all required fields.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

  let accounts = JSON.parse(localStorage.getItem('tavusha_accounts') || '[]');
  if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
    errEl.textContent = 'An account with this email already exists.'; return;
  }

  accounts.push({ name, email, phone, password: btoa(password), joinedAt: new Date().toISOString() });
  localStorage.setItem('tavusha_accounts', JSON.stringify(accounts));
  setCustSession({ name, email, phone });
  onAuthSuccess(`Welcome to TAVUSHA, ${name.split(' ')[0]}! ✨`);
}

// ─── On Success ────────────────────────────────────────────────
function onAuthSuccess(msg) {
  closeAuthPopup();
  updateAuthNav();
  if (typeof showToast === 'function') showToast(msg, 'success');
  if (typeof _authResolve === 'function') {
    setTimeout(_authResolve, 300);
    _authResolve = null;
  }
}

// ─── Update Nav Login/Logout button ───────────────────────────
function updateAuthNav() {
  const btnEl = document.getElementById('navAuthBtn');
  if (!btnEl) return;
  const session = getCustSession();
  if (session) {
    btnEl.textContent = session.name.split(' ')[0];
    btnEl.title = 'Click to logout';
    btnEl.onclick = customerLogout;
  } else {
    btnEl.textContent = 'Login';
    btnEl.title = 'Login / Sign Up';
    btnEl.onclick = () => openAuthPopup();
  }
}

function customerLogout() {
  clearCustSession();
  updateAuthNav();
  if (typeof showToast === 'function') showToast('You have been logged out.', 'info');
}

// ─── 3-Minute Auto-Popup Timer ────────────────────────────────
function initAuthTimer() {
  if (isLoggedIn()) return; // already logged in
  const seen = sessionStorage.getItem('tavusha_auth_prompted');
  if (seen) return; // don't re-show in same tab session
  setTimeout(() => {
    if (!isLoggedIn()) {
      sessionStorage.setItem('tavusha_auth_prompted', '1');
      openAuthPopup();
    }
  }, 3 * 60 * 1000); // 3 minutes
}

// ─── Guard: require login before checkout ─────────────────────
// Patches the global openCheckout() fn to require auth first
function patchCheckoutWithAuth() {
  const _origOpenCheckout = window.openCheckout;
  if (typeof _origOpenCheckout !== 'function') return;
  window.openCheckout = function() {
    if (isLoggedIn()) {
      _origOpenCheckout.apply(this, arguments);
    } else {
      // Open login popup; on success, run checkout
      openAuthPopup(() => _origOpenCheckout.apply(window, arguments));
    }
  };
}

// ─── Also guard placeOrder() ──────────────────────────────────
function patchPlaceOrderWithAuth() {
  const _origPlaceOrder = window.placeOrder;
  if (typeof _origPlaceOrder !== 'function') return;
  window.placeOrder = function() {
    if (isLoggedIn()) {
      // Pre-fill customer email if available
      const session = getCustSession();
      const emailEl = document.getElementById('coEmail');
      const nameEl  = document.getElementById('coName');
      const phoneEl = document.getElementById('coPhone');
      if (emailEl && !emailEl.value && session?.email) emailEl.value = session.email;
      if (nameEl  && !nameEl.value  && session?.name)  nameEl.value  = session.name;
      if (phoneEl && !phoneEl.value && session?.phone) phoneEl.value = session.phone;
      _origPlaceOrder.apply(this, arguments);
    } else {
      openAuthPopup(() => _origPlaceOrder.apply(window, arguments));
    }
  };
}

// ─── DOM Ready Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectAuthPopupHTML();
  updateAuthNav();
  initAuthTimer();
  // Patch after main.js has set up openCheckout/placeOrder
  setTimeout(() => {
    patchCheckoutWithAuth();
    patchPlaceOrderWithAuth();
  }, 100);
});

// ─── Inject popup HTML dynamically ────────────────────────────
function injectAuthPopupHTML() {
  if (document.getElementById('authPopupOverlay')) return;
  const el = document.createElement('div');
  el.innerHTML = `
<!-- ═══ AUTH POPUP OVERLAY ════════════════════════════════════ -->
<div class="auth-popup-overlay" id="authPopupOverlay">
  <div class="auth-popup" id="authPopup" role="dialog" aria-modal="true" aria-label="Login or Create Account">

    <!-- Close -->
    <button class="auth-popup__close" id="authPopupClose" onclick="closeAuthPopup()" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Brand Header -->
    <div class="auth-popup__brand">
      <div class="auth-popup__logo">TAVUSHA</div>
      <p class="auth-popup__tagline">Login to continue your style journey</p>
    </div>

    <!-- Perks strip -->
    <div class="auth-popup__perks">
      <div class="auth-perk"><span>✦</span> Track your orders</div>
      <div class="auth-perk"><span>✦</span> Save your wishlist</div>
      <div class="auth-perk"><span>✦</span> Exclusive member offers</div>
    </div>

    <!-- Tabs -->
    <div class="auth-tabs">
      <button class="auth-tab-btn active" id="authTabLogin"  onclick="switchAuthTab('login')">Login</button>
      <button class="auth-tab-btn"        id="authTabSignup" onclick="switchAuthTab('signup')">Create Account</button>
    </div>

    <!-- ── LOGIN FORM ── -->
    <form class="auth-form" id="authLoginForm" onsubmit="handleCustomerLogin(event)" novalidate>
      <div class="auth-field">
        <label class="auth-label" for="authLoginEmail">Email Address</label>
        <input class="auth-input" type="email" id="authLoginEmail" placeholder="you@email.com" autocomplete="email" required>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="authLoginPassword">Password</label>
        <input class="auth-input" type="password" id="authLoginPassword" placeholder="Your password" autocomplete="current-password" required>
      </div>
      <p class="auth-error" id="authLoginError"></p>
      <button type="submit" class="auth-submit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Sign In
      </button>
      <p class="auth-switch">New here? <button type="button" class="auth-link" onclick="switchAuthTab('signup')">Create a free account</button></p>
    </form>

    <!-- ── SIGNUP FORM ── -->
    <form class="auth-form" id="authSignupForm" onsubmit="handleCustomerSignup(event)" novalidate style="display:none">
      <div class="auth-field">
        <label class="auth-label" for="authSignupName">Full Name <span class="auth-req">*</span></label>
        <input class="auth-input" type="text"  id="authSignupName"  placeholder="e.g. Priya Sharma" autocomplete="name" required>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="authSignupEmail">Email Address <span class="auth-req">*</span></label>
        <input class="auth-input" type="email" id="authSignupEmail" placeholder="you@email.com" autocomplete="email" required>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="authSignupPhone">Phone Number</label>
        <input class="auth-input" type="tel"   id="authSignupPhone" placeholder="10-digit mobile" autocomplete="tel">
      </div>
      <div class="auth-field">
        <label class="auth-label" for="authSignupPassword">Password <span class="auth-req">*</span></label>
        <input class="auth-input" type="password" id="authSignupPassword" placeholder="Min. 6 characters" autocomplete="new-password" required>
      </div>
      <p class="auth-error" id="authSignupError"></p>
      <button type="submit" class="auth-submit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Create My Account
      </button>
      <p class="auth-switch">Already have an account? <button type="button" class="auth-link" onclick="switchAuthTab('login')">Sign in</button></p>
    </form>

  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);

  // Close on overlay click (not popup itself)
  document.getElementById('authPopupOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeAuthPopup();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAuthPopup();
  });
}
