/* ============================================================
   TAVUSHA — Main JS
   Reference: Snappy interactions, colored card BG zones,
   cat browser activation, inline product rendering
   ============================================================ */
'use strict';

// ─── State ────────────────────────────────────────────────────
const TAVUSHA = {
  cart:     JSON.parse(localStorage.getItem('tavusha_cart')     || '[]'),
  wishlist: JSON.parse(localStorage.getItem('tavusha_wishlist') || '[]'),
  quickViewProduct: null,
  selectedSize:     null
};

// Card color zones — reference: colored photographic background
const CARD_COLORS = [
  'var(--card-rose)',
  'var(--card-champagne)',
  'var(--card-sage)',
  'var(--card-blush)',
  'var(--card-mist)',
  'var(--card-wheat)'
];

// ─── DOM Ready ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initNav();
  initCursor();
  initScrollReveal();
  initMobileMenu();
  initAnnouncement();
  renderHeroProductRow();
  updateCartUI();
  updateWishlistUI();
  initKeyboard();
  initCatBrowser();
  initMiniProductHover();
});

// ─── LOADER ───────────────────────────────────────────────────
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    loader.classList.add('hidden');
    document.body.style.overflow = '';
    // Animate hero elements after load
    triggerHeroAnimation();
  }, 1800);
}

function triggerHeroAnimation() {
  const els = document.querySelectorAll('.hero__left > *, .hero__right > *');
  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '';
        el.style.transform = '';
      });
    });
  });
}

// ─── NAVIGATION ───────────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let lastY = 0, ticking = false;
  window.addEventListener('scroll', () => {
    lastY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(() => {
        // Reference: nav stays on top, mild shadow on scroll
        if (lastY > 60) {
          nav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.06)';
        } else {
          nav.style.boxShadow = '';
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ─── CUSTOM CURSOR ────────────────────────────────────────────
function initCursor() {
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring || window.innerWidth < 1024) {
    if (dot)  dot.style.display  = 'none';
    if (ring) ring.style.display = 'none';
    return;
  }
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });
  (function animate() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animate);
  })();

  // Grow on interactive elements
  const hoverEls = document.querySelectorAll('a,button,.product-card,.editorial-item,.cat-item,.hero__mini-card');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.style.width = '14px'; dot.style.height = '14px';
      ring.style.width = '56px'; ring.style.height = '56px';
      ring.style.borderColor = 'var(--brand)';
    });
    el.addEventListener('mouseleave', () => {
      dot.style.width = '8px'; dot.style.height = '8px';
      ring.style.width = '32px'; ring.style.height = '32px';
      ring.style.borderColor = 'rgba(12,10,9,0.35)';
    });
  });
}

// ─── SCROLL REVEAL ────────────────────────────────────────────
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// Re-init for dynamically added elements
function reInitReveal(container) {
  const els = container.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.06 });
  setTimeout(() => els.forEach(el => obs.observe(el)), 50);
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const menu      = document.getElementById('mobileMenu');
  const closeBtn  = document.getElementById('mobileMenuClose');
  if (!hamburger || !menu) return;
  hamburger.addEventListener('click', () => {
    menu.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);
  menu.querySelectorAll('.mobile-menu__link').forEach(a =>
    a.addEventListener('click', closeMobileMenu)
  );
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── ANNOUNCEMENT ─────────────────────────────────────────────
function initAnnouncement() {
  const btn = document.getElementById('announcementClose');
  const bar = document.getElementById('announcement');
  if (!btn || !bar) return;
  btn.addEventListener('click', () => {
    bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease';
    bar.style.maxHeight = '0';
    bar.style.overflow  = 'hidden';
    bar.style.opacity   = '0';
    bar.style.padding   = '0';
  });
}

// ─── PRODUCT CARD RENDERER ─────────────────────────────────────
// Reference: Colored BG top zone + White info + Badge pill + 2 action circles
function renderProductCard(product, colorIdx) {
  const color = CARD_COLORS[colorIdx % CARD_COLORS.length];

  const badgeMap = { new: 'badge', sale: 'badge badge--red', limited: 'badge badge--warm', bestseller: 'badge badge--gold' };
  const badgeLabelMap = { new: 'New', sale: 'Sale', limited: 'Limited', bestseller: 'Hot' };

  const priceHTML = product.originalPrice
    ? `<span class="product-card__price">₹${product.price.toLocaleString('en-IN')}</span>
       <span class="product-card__price-orig">₹${product.originalPrice.toLocaleString('en-IN')}</span>`
    : `<span class="product-card__price">₹${product.price.toLocaleString('en-IN')}</span>`;

  const starsHTML = Array.from({length: 5}, (_, i) =>
    `<svg width="10" height="10" viewBox="0 0 24 24" fill="${i < Math.round(product.rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  ).join('');

  const isWishlisted = TAVUSHA.wishlist.includes(product.id);

  return `
    <div class="product-card reveal" data-id="${product.id}" onclick="openQuickView(${product.id})">
      <div class="product-card__media" style="--card-bg:${color}">
        <img class="product-card__img" src="${product.image}" alt="${product.name}" loading="lazy">
        ${product.badge ? `<span class="product-card__badge ${badgeMap[product.badge] || ''}">${badgeLabelMap[product.badge] || product.badge}</span>` : ''}
        <!-- Two action circles — reference pattern -->
        <div class="product-card__actions">
          <button class="product-card__action-btn ${isWishlisted ? 'active' : ''}"
            onclick="event.stopPropagation(); toggleWishlistCard(this, ${product.id})"
            aria-label="Wishlist">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="product-card__action-btn"
            onclick="event.stopPropagation(); openQuickView(${product.id})"
            aria-label="Quick View">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="product-card__body">
        <div class="product-card__name">${product.name}</div>
        <div class="product-card__rating">
          <div class="product-card__stars">${starsHTML}</div>
          <span class="product-card__rating-num">${product.rating}</span>
        </div>
        <div>${priceHTML}</div>
      </div>
    </div>`;
}

// ─── HERO PRODUCT ROW ─────────────────────────────────────────
// Reference: Horizontal 4-card row below split-header
function renderHeroProductRow() {
  const grid = document.getElementById('heroProductRow');
  if (!grid || typeof TAVUSHA_PRODUCTS === 'undefined') return;

  // Show first 4 trending products
  const picks = TAVUSHA_PRODUCTS
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 4);

  grid.innerHTML = picks.map((p, i) => renderProductCard(p, i)).join('');
  reInitReveal(grid);
}

// ─── CATEGORY BROWSER ACTIVATION ─────────────────────────────
function initCatBrowser() {
  // Ensure first active item is highlighted from page load
  const activeItem = document.querySelector('.cat-item.active');
  if (activeItem) {
    activeItem.style.fontWeight = '700';
  }
}

function activateCat(el, cat) {
  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  showToast(`Browsing ${el.textContent.trim()}`, 'info');
}

function setTabActive(btn) {
  btn.closest('.cat-tabs').querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

// ─── MINI PRODUCT HOVER ───────────────────────────────────────
function initMiniProductHover() {
  const cards = document.querySelectorAll('.hero__mini-card');
  const dots  = document.querySelectorAll('.hero__mini-dot');
  cards.forEach((card, i) => {
    card.addEventListener('mouseenter', () => {
      cards.forEach(c => c.classList.remove('active'));
      dots.forEach(d => d.classList.remove('active'));
      card.classList.add('active');
      if (dots[i]) dots[i].classList.add('active');
    });
  });
}

// ─── FILTER + SCROLL ──────────────────────────────────────────
function filterAndGo(cat) {
  document.getElementById('split-section')?.scrollIntoView({ behavior: 'smooth' });
  showToast(`Viewing ${cat} collection`, 'info');
}

// ─── QUICK VIEW ───────────────────────────────────────────────
function openQuickView(id) {
  const product = TAVUSHA_PRODUCTS.find(p => p.id === id);
  if (!product) return;
  TAVUSHA.quickViewProduct = product;
  TAVUSHA.selectedSize = null;

  const colorIdx = TAVUSHA_PRODUCTS.indexOf(product) % CARD_COLORS.length;
  const color = CARD_COLORS[colorIdx].replace('var(', '').replace(')', '');

  const gallery = document.querySelector('.quick-view__gallery');
  if (gallery) gallery.style.background = `var(${color})`;

  document.getElementById('quickViewImg').src   = product.image;
  document.getElementById('quickViewImg').alt   = product.name;
  document.getElementById('quickViewBrand').textContent = product.brand;
  document.getElementById('quickViewName').textContent  = product.name;
  document.getElementById('quickViewPrice').innerHTML   = product.originalPrice
    ? `₹${product.price.toLocaleString('en-IN')} <span style="text-decoration:line-through;color:var(--warm-grey);font-size:0.9rem;font-weight:400">₹${product.originalPrice.toLocaleString('en-IN')}</span>`
    : `₹${product.price.toLocaleString('en-IN')}`;

  const sizesEl = document.getElementById('quickViewSizes');
  sizesEl.innerHTML = product.sizes.map(s =>
    `<button class="size-pill" onclick="selectSize(this,'${s}')">${s}</button>`
  ).join('');

  const wishBtn = document.getElementById('quickViewWishBtn');
  const isWish  = TAVUSHA.wishlist.includes(id);
  wishBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="${isWish ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  ${isWish ? 'Remove from Wishlist' : 'Add to Wishlist'}`;

  document.getElementById('quickViewOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeQuickView(e) {
  if (e && e.target !== document.getElementById('quickViewOverlay')) return;
  document.getElementById('quickViewOverlay').classList.remove('open');
  document.body.style.overflow = '';
  TAVUSHA.quickViewProduct = null;
  TAVUSHA.selectedSize = null;
}

function selectSize(btn, size) {
  document.querySelectorAll('.size-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  TAVUSHA.selectedSize = size;
}

// ─── CART ─────────────────────────────────────────────────────
function addToCartFromQuickView() {
  if (!TAVUSHA.quickViewProduct) return;
  if (!TAVUSHA.selectedSize) {
    const sizesEl = document.getElementById('quickViewSizes');
    if (sizesEl) {
      sizesEl.style.animation = 'shakeX 0.35s ease';
      setTimeout(() => { sizesEl.style.animation = ''; }, 350);
    }
    showToast('Please select a size', 'info');
    return;
  }
  addToCart(TAVUSHA.quickViewProduct, TAVUSHA.selectedSize);
  setTimeout(() => {
    document.getElementById('quickViewOverlay').classList.remove('open');
    document.body.style.overflow = '';
    openCart();
  }, 350);
}

function addToCart(product, size) {
  const existing = TAVUSHA.cart.find(i => i.id === product.id && i.size === size);
  if (existing) { existing.qty += 1; }
  else {
    TAVUSHA.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, brand: product.brand, size, qty: 1 });
  }
  saveCart();
  updateCartUI();
  showToast(`${product.name} added to your bag`, 'success');
  animateCartIcon();
}

function removeFromCart(id, size) {
  TAVUSHA.cart = TAVUSHA.cart.filter(i => !(i.id === id && i.size === size));
  saveCart(); updateCartUI(); renderCartItems();
}

function updateCartQty(id, size, delta) {
  const item = TAVUSHA.cart.find(i => i.id === id && i.size === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id, size); return; }
  saveCart(); updateCartUI(); renderCartItems();
}

function saveCart() { localStorage.setItem('tavusha_cart', JSON.stringify(TAVUSHA.cart)); }

function updateCartUI() {
  const count = TAVUSHA.cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
  const total = TAVUSHA.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

function openCart() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartItems() {
  const c      = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  if (!c) return;
  if (!TAVUSHA.cart.length) {
    c.innerHTML = `<div class="cart-drawer__empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      <div><p style="font-family:var(--font-display);font-size:1.1rem;color:var(--text-secondary)">Your bag is empty</p><p style="font-size:0.78rem;color:var(--warm-grey)">Add something beautiful</p></div>
      <button class="btn-pill" onclick="closeCart()"><span>Continue Shopping</span></button>
    </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }
  if (footer) footer.style.display = 'block';
  c.innerHTML = TAVUSHA.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item__img"><img src="${item.image}" alt="${item.name}" loading="lazy"></div>
      <div class="cart-item__info">
        <div>
          <div class="cart-item__name">${item.name}</div>
          <div class="cart-item__meta">Size: ${item.size} · ${item.brand}</div>
        </div>
        <div class="cart-item__controls">
          <div class="cart-item__qty">
            <button class="cart-item__qty-btn" onclick="updateCartQty(${item.id},'${item.size}',-1)">−</button>
            <span class="cart-item__qty-num">${item.qty}</span>
            <button class="cart-item__qty-btn" onclick="updateCartQty(${item.id},'${item.size}',1)">+</button>
          </div>
          <span class="cart-item__price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
        </div>
        <button class="cart-item__remove" onclick="removeFromCart(${item.id},'${item.size}')">Remove</button>
      </div>
    </div>`).join('');
  updateCartUI();
}

function animateCartIcon() {
  const btn = document.getElementById('cartBtn');
  if (!btn) return;
  btn.style.transition = 'transform 0.2s var(--ease-snap)';
  btn.style.transform = 'scale(1.35)';
  setTimeout(() => { btn.style.transform = ''; }, 200);
}

// ─── WISHLIST ─────────────────────────────────────────────────
function toggleWishlistCard(btn, id) {
  const idx = TAVUSHA.wishlist.indexOf(id);
  const svg = btn.querySelector('svg');
  if (idx === -1) {
    TAVUSHA.wishlist.push(id);
    btn.classList.add('active');
    if (svg) svg.setAttribute('fill', 'currentColor');
    showToast('Added to wishlist', 'success');
  } else {
    TAVUSHA.wishlist.splice(idx, 1);
    btn.classList.remove('active');
    if (svg) svg.setAttribute('fill', 'none');
    showToast('Removed from wishlist', 'info');
  }
  localStorage.setItem('tavusha_wishlist', JSON.stringify(TAVUSHA.wishlist));
  updateWishlistUI();
}

function toggleWishlistQuickView() {
  if (!TAVUSHA.quickViewProduct) return;
  const id  = TAVUSHA.quickViewProduct.id;
  const idx = TAVUSHA.wishlist.indexOf(id);
  const wishBtn = document.getElementById('quickViewWishBtn');
  if (idx === -1) {
    TAVUSHA.wishlist.push(id);
    if (wishBtn) wishBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Remove from Wishlist`;
    showToast('Added to wishlist', 'success');
  } else {
    TAVUSHA.wishlist.splice(idx, 1);
    if (wishBtn) wishBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Add to Wishlist`;
    showToast('Removed from wishlist', 'info');
  }
  localStorage.setItem('tavusha_wishlist', JSON.stringify(TAVUSHA.wishlist));
  updateWishlistUI();
}

function updateWishlistUI() {
  const el    = document.getElementById('wishlistCount');
  const count = TAVUSHA.wishlist.length;
  if (el) { el.textContent = count; el.style.display = count > 0 ? 'flex' : 'none'; }
}

// ─── SEARCH ───────────────────────────────────────────────────
function openSearch() {
  document.getElementById('searchOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('searchInput')?.focus(), 180);
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
function handleSearch(e) {
  e.preventDefault();
  const val = document.getElementById('searchInput')?.value?.trim();
  if (val) doSearch(val);
}
function doSearch(q) {
  closeSearch();
  const results = TAVUSHA_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.brand.toLowerCase().includes(q.toLowerCase()) ||
    p.category.some(c => c.toLowerCase().includes(q.toLowerCase()))
  );
  showToast(`Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"`, results.length ? 'success' : 'info');
}

// ─── NEWSLETTER ───────────────────────────────────────────────
function handleNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail')?.value;
  if (!email) return;
  showToast('Welcome to TAVUSHA! Check your inbox for a 10% off code.', 'success');
  document.getElementById('newsletterEmail').value = '';
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = {
    success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
  };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="toast__icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 3500);
}

// ─── KEYBOARD ─────────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeCart(); closeSearch();
      document.getElementById('quickViewOverlay')?.classList.remove('open');
      document.getElementById('mobileMenu')?.classList.remove('open');
      document.body.style.overflow = '';
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  // Bind cart/search/wishlist buttons
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('searchBtn')?.addEventListener('click', openSearch);
  document.getElementById('wishlistBtn')?.addEventListener('click', () => {
    showToast('Your wishlist will open soon', 'info');
  });
}

// ─── SHAKE ANIMATION ─────────────────────────────────────────
const _s = document.createElement('style');
_s.textContent = `@keyframes shakeX{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`;
document.head.appendChild(_s);
