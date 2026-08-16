/* ============================================================
   TAVUSHA — Main JS
   Reference: Snappy interactions, colored card BG zones,
   cat browser activation, inline product rendering
   ============================================================ */
'use strict';

function fixDriveUrl(url) {
  if (!url) return '';
  var m = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/) || url.match(/\/d\/([^/]+)/);
  return (m && m[1]) ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800' : url;
}

let parsedCart = [];
try { parsedCart = JSON.parse(localStorage.getItem('tavusha_cart')) || []; } catch(e) {}
if (!Array.isArray(parsedCart)) parsedCart = [];

let parsedWishlist = [];
try { parsedWishlist = JSON.parse(localStorage.getItem('tavusha_wishlist')) || []; } catch(e) {}
if (!Array.isArray(parsedWishlist)) parsedWishlist = [];

const TAVUSHA = {
  cart:     parsedCart,
  wishlist: parsedWishlist,
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
  const hide = () => {
    if (loader.classList.contains('hidden')) return;
    loader.classList.add('hidden');
    document.body.style.overflow = '';
    triggerHeroAnimation();
  };
  // Hide as soon as DOM is interactive
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(hide, 100);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(hide, 100), { once: true });
  }
  // Hard cap: never stay on screen more than 2.5s regardless of pending fetches
  setTimeout(hide, 2500);
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
    <div class="product-card reveal" data-id="${product.id}" onclick="openQuickView('${product.id}')">
      <div class="product-card__media" style="--card-bg:${color}">
        <img class="product-card__img" src="${typeof fixDriveUrl==='function'?fixDriveUrl(product.image):product.image}" data-orig-src="${product.image}" alt="${product.name}" loading="lazy"
          onerror="if(typeof tavushaImgError==='function'){tavushaImgError(this);}">
        ${product.badge ? `<span class="product-card__badge ${badgeMap[product.badge] || ''}">${badgeLabelMap[product.badge] || product.badge}</span>` : ''}
        <!-- Two action circles — reference pattern -->
        <div class="product-card__actions">
          <button class="product-card__action-btn ${isWishlisted ? 'active' : ''}"
            onclick="event.stopPropagation(); toggleWishlistCard(this, '${product.id}')"
            aria-label="Wishlist">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="product-card__action-btn"
            onclick="event.stopPropagation(); openQuickView('${product.id}')"
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
  
  const imgMain = document.querySelector('.cat-browser__img-main');
  const imgSec = document.querySelector('.cat-browser__img-secondary');
  if (imgMain && imgSec) {
    imgMain.style.transition = 'opacity 0.15s ease';
    imgSec.style.transition = 'opacity 0.15s ease';
    
    const catsData = {
      party: { m: 'assets/images/party_wear.jpg', s: 'assets/images/wedding.jpg' },
      coord: { m: 'assets/images/vacation.jpg', s: 'assets/images/workwear.jpg' },
      maxi: { m: 'assets/images/hero_fashion.jpg', s: 'assets/images/ethnic.jpg' },
      workwear: { m: 'assets/images/workwear.jpg', s: 'assets/images/party_wear.jpg' },
      accessories: { m: 'assets/images/ethnic.jpg', s: 'assets/images/wedding.jpg' }
    };
    if (catsData[cat]) {
      imgMain.style.opacity = '0'; imgSec.style.opacity = '0';
      setTimeout(() => {
        imgMain.src = catsData[cat].m;
        imgSec.src = catsData[cat].s;
        imgMain.style.opacity = '1'; imgSec.style.opacity = '1';
      }, 150);
    }
    
    // Ensure clicking image navigates to shop category
    const stack = document.querySelector('.cat-browser__image-stack');
    if (stack) {
      stack.style.cursor = 'pointer';
      stack.onclick = () => window.location.href = `shop.html?cat=${cat}`;
    }
  }
}

function setTabActive(btn) {
  btn.closest('.cat-tabs').querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  // Also tweak images slightly based on Casual / Evening / Festive vibes to make it feel alive!
  const imgMain = document.querySelector('.cat-browser__img-main');
  const imgSec = document.querySelector('.cat-browser__img-secondary');
  const mood = btn.textContent.toLowerCase();
  if (imgMain && imgSec) {
    imgMain.style.transition = 'opacity 0.15s ease';
    imgSec.style.transition = 'opacity 0.15s ease';
    
    // Highlight the button effect
    imgMain.style.opacity = '0'; imgSec.style.opacity = '0';
    setTimeout(() => {
      if (mood === 'evening') {
        imgMain.src = 'assets/images/party_wear.jpg'; imgSec.src = 'assets/images/wedding.jpg';
      } else if (mood === 'festive') {
        imgMain.src = 'assets/images/ethnic.jpg'; imgSec.src = 'assets/images/party_wear.jpg';
      } else {
        imgMain.src = 'assets/images/hero_fashion.jpg'; imgSec.src = 'assets/images/vacation.jpg';
      }
      imgMain.style.opacity = '1'; imgSec.style.opacity = '1';
    }, 150);
  }
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
  const product = TAVUSHA_PRODUCTS.find(p => p.id == id);
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

// ─── INTERACTIVE STYLE QUIZ ───────────────────────────────────
function updateStyleQuiz(mode, btn) {
  document.querySelectorAll('.style-quiz-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const imgEl   = document.getElementById('quizImg');
  const titleEl = document.getElementById('quizTitle');
  const descEl  = document.getElementById('quizDesc');

  const quizData = {
    gala: {
      img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80',
      title: 'Ivory Silk Evening Gown',
      desc: 'Draped cowl neckline in champagne silk. Pair with minimal gold jewelry.',
      id: 1
    },
    brunch: {
      img: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300&q=80',
      title: 'Blush Satin Co-ord Set',
      desc: 'Cropped tailored blazer and wide-leg trousers—effortlessly chic.',
      id: 2
    },
    sangeet: {
      img: 'assets/images/ethnic.jpg',
      title: 'Gold Embroidered Anarkali',
      desc: 'Intricate gold threadwork on a flowing silhouette. Ceremonial splendour.',
      id: 9
    },
    office: {
      img: 'assets/images/workwear.jpg',
      title: 'Ivory Oversized Blazer',
      desc: 'Structured power blazer with peak lapels. Boardroom to dinner ready.',
      id: 7
    }
  };

  const item = quizData[mode] || quizData.gala;
  if (imgEl)   imgEl.src = item.img;
  if (titleEl) titleEl.textContent = item.title;
  if (descEl)  descEl.textContent  = item.desc;
}

// ─── STOCK HELPER ────────────────────────────────────────────
// Returns available stock for a given product id and optional colour.
// Priority: admin sp_demo_products override → TAVUSHA_PRODUCTS → EXCEL_PRODUCTS → fallback 99
function getProductStock(productId, colorName) {
  const pIdStr = String(productId || '').toLowerCase().trim();
  const pIdDigits = pIdStr.replace(/\D/g, '');

  // 1. Check admin demo overrides first (set via admin portal in localStorage)
  try {
    const demoProd = JSON.parse(localStorage.getItem('sp_demo_products') || '[]');
    const match = demoProd.find(p => {
      const p_id = String(p._id || '').toLowerCase().trim();
      const p_sku = String(p.sku || '').toLowerCase().trim();
      const p_id_direct = String(p.id || '').toLowerCase().trim();
      const p_id_digits = p_id.replace(/\D/g, '');
      return (
        p_id === pIdStr ||
        p_id === 'itm' + pIdStr ||
        p_id === 'p_' + pIdStr ||
        p_id_direct === pIdStr ||
        p_sku === pIdStr ||
        p_sku === 'itm' + pIdStr ||
        (pIdDigits && p_id_digits && pIdDigits === p_id_digits)
      );
    });

    if (match) {
      if (colorName && Array.isArray(match.colorVariants) && match.colorVariants.length > 0) {
        const cMatch = match.colorVariants.find(v => (v.color || '').toLowerCase().trim() === colorName.toLowerCase().trim());
        if (cMatch && cMatch.stock !== undefined) return Math.max(0, Number(cMatch.stock));
      }
      if (match.stock !== undefined) return Math.max(0, Number(match.stock));
    }
  } catch(e) {}

  // 2. Fall back to compiled TAVUSHA_PRODUCTS
  if (typeof TAVUSHA_PRODUCTS !== 'undefined' && Array.isArray(TAVUSHA_PRODUCTS)) {
    const prod = TAVUSHA_PRODUCTS.find(p => {
      const tIdStr = String(p.id || '').toLowerCase().trim();
      const tIdDigits = tIdStr.replace(/\D/g, '');
      return tIdStr === pIdStr || (pIdDigits && tIdDigits && pIdDigits === tIdDigits);
    });
    if (prod && prod.stock !== undefined) return Math.max(0, Number(prod.stock));
  }

  // 3. Check EXCEL_PRODUCTS
  if (typeof EXCEL_PRODUCTS !== 'undefined' && Array.isArray(EXCEL_PRODUCTS)) {
    const exMatch = EXCEL_PRODUCTS.find(p => {
      const e_id = String(p._id || '').toLowerCase().trim();
      const e_sku = String(p.sku || '').toLowerCase().trim();
      const e_digits = e_id.replace(/\D/g, '');
      return e_id === pIdStr || e_sku === pIdStr || (pIdDigits && e_digits && pIdDigits === e_digits);
    });
    if (exMatch && exMatch.stock !== undefined) return Math.max(0, Number(exMatch.stock));
  }

  return 99; // No stock data → uncapped
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
  addToCart(TAVUSHA.quickViewProduct, TAVUSHA.selectedSize, TAVUSHA.selectedColour);
  setTimeout(() => {
    document.getElementById('quickViewOverlay').classList.remove('open');
    document.body.style.overflow = '';
    openCart();
  }, 350);
}

function addToCart(product, size, colour) {
  const col = colour || (product.colour ? product.colour.split(',')[0].trim() : '');
  const stock = getProductStock(product.id);

  // Block add entirely if out of stock
  if (stock === 0) {
    showToast(`${product.name} is out of stock`, 'error');
    return;
  }

  const existing = TAVUSHA.cart.find(i => String(i.id) === String(product.id) && i.size === size && (i.colour || '') === col);
  if (existing) {
    if (existing.qty >= stock) {
      showToast(`Only ${stock} piece${stock !== 1 ? 's' : ''} available for ${product.name}`, 'info');
      return;
    }
    existing.qty += 1;
  } else {
    TAVUSHA.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, brand: product.brand || 'TAVUSHA', size, colour: col, qty: 1, stock });
  }
  saveCart();
  updateCartUI();
  showToast(`${product.name}${col ? ' (' + col + ')' : ''} added to your bag`, 'success');
  animateCartIcon();
}

function removeFromCart(id, size, colour) {
  TAVUSHA.cart = TAVUSHA.cart.filter(i => !(String(i.id) === String(id) && i.size === size && (colour === undefined || (i.colour || '') === (colour || ''))));
  saveCart(); updateCartUI(); renderCartItems();
}

function updateCartQty(id, size, delta, colour) {
  const item = TAVUSHA.cart.find(i => String(i.id) === String(id) && i.size === size && (colour === undefined || (i.colour || '') === (colour || '')));
  if (!item) return;
  if (delta > 0) {
    // Refresh stock in case admin has updated it
    const stock = getProductStock(id);
    if (item.qty >= stock) {
      showToast(`Only ${stock} piece${stock !== 1 ? 's' : ''} available for this item`, 'info');
      return;
    }
  }
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id, size, colour); return; }
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
  document.getElementById('quickViewOverlay')?.classList.remove('open');
  document.getElementById('mobileMenu')?.classList.remove('open');
  document.getElementById('searchOverlay')?.classList.remove('open');
  TAVUSHA.quickViewProduct = null;
  TAVUSHA.selectedSize = null;
  TAVUSHA.selectedColour = null;
  document.getElementById('cartOverlay')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
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
  c.innerHTML = TAVUSHA.cart.map(item => {
    const escapedCol = (item.colour || '').replace(/'/g, "\\'");
    const itemStock = getProductStock(item.id);
    const atMax = item.qty >= itemStock;
    const plusDisabled = atMax ? 'disabled style="opacity:0.35;cursor:not-allowed"' : '';
    const stockNote = atMax ? `<div style="font-size:0.68rem;color:#a07840;margin-top:2px">Max qty reached (${itemStock} in stock)</div>` : '';
    return `
    <div class="cart-item">
      <div class="cart-item__img"><img src="${item.image}" alt="${item.name}" loading="lazy"></div>
      <div class="cart-item__info">
        <div>
          <div class="cart-item__name">${item.name}</div>
          <div class="cart-item__meta">Size: ${item.size}${item.colour ? ` · Colour: ${item.colour}` : ''} · ${item.brand || 'TAVUSHA'}</div>
          ${stockNote}
        </div>
        <div class="cart-item__controls">
          <div class="cart-item__qty">
            <button class="cart-item__qty-btn" onclick="updateCartQty('${item.id}','${item.size}',-1,'${escapedCol}')">−</button>
            <span class="cart-item__qty-num">${item.qty}</span>
            <button class="cart-item__qty-btn" onclick="updateCartQty('${item.id}','${item.size}',1,'${escapedCol}')" ${plusDisabled}>+</button>
          </div>
          <span class="cart-item__price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
        </div>
        <button class="cart-item__remove" onclick="removeFromCart('${item.id}','${item.size}','${escapedCol}')">Remove</button>
      </div>
    </div>`;
  }).join('');
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
  const el = document.getElementById('searchOverlay');
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('searchInput')?.focus(), 180);
}
function closeSearch() {
  const el = document.getElementById('searchOverlay');
  if (el) el.classList.remove('open');
  document.body.style.overflow = '';
}
function handleSearch(e) {
  e.preventDefault();
  const val = document.getElementById('searchInput')?.value?.trim();
  if (val) doSearch(val);
}
function doSearch(q) {
  closeSearch();
  if (window.location.pathname.endsWith('shop.html') && typeof window.filterShopBySearch === 'function') {
    window.filterShopBySearch(q);
  } else {
    window.location.href = 'shop.html?q=' + encodeURIComponent(q);
  }
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

// ─── CHECKOUT ─────────────────────────────────────────────────
const API_BASE = 'https://tavusha2-backend.onrender.com/api';

// Shipping zone rules (client-side fallback matching backend ShippingZone.js)
const SHIPPING_ZONES = [
  { name: 'North India',           prefixes: ['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','104','105','106','107','108','109','110','120','121','122','123','124','125','126','127','128','129','130','131','132','133','134','135','136','137','138','139','140','141','142','143','144','145','146','147','148','149','150','151','152','153','154','155','156','157','158','159','160','161','162','163','164','165','166','167','168','169','170','171','172','173','174','175','176','177','178','179','180','181','182','183','184','185','186','187','188','189','190','191','192','193','194','195','196','197','198','199','200','201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','218','219','220','221','222','223','224','225','226','227','228','229','230','231','232','233','234','235','236','237','238','239','240','241','242','243','244','245','246','247','248','249','250','251','252','253','254','255','256','257','258','259','260','261','262','263','264','265','266','267','268','269','270','271','272','273','274','275','276','277','278','279','280','281','282','283','284','285','286','287','288','289','290','291','292','293','294','295','296','297','298','299','301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','316','317','318','319','320','321','322','323','324','325','326','327','328','329','330','331','332','333','334','335'],
    rate: 60 },
  { name: 'West Bengal & Assam',   prefixes: ['7','8'],  rate: 100 },
  { name: 'North-East India',      prefixes: ['78','79','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97'],  rate: 150 },
  { name: 'Central & South India', prefixes: [],         rate: 100 }  // default
];

function calcShippingRate(pin) {
  if (!pin || pin.length < 6) return { zone: '—', rate: 0 };
  const prefix2 = pin.slice(0, 2);
  const prefix1 = pin.slice(0, 1);

  // North-East first (more specific)
  const ne = ['78','79','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97'];
  if (ne.includes(prefix2)) return { zone: 'North-East India', rate: 150 };

  // WB & Assam
  if (prefix1 === '7' || prefix1 === '8') return { zone: 'West Bengal & Assam', rate: 100 };

  // North India: PIN starts with 1-3 or specific ranges
  const northStart = parseInt(prefix2, 10);
  if (northStart >= 11 && northStart <= 34) return { zone: 'North India', rate: 60 };
  if (northStart >= 40 && northStart <= 49) return { zone: 'North India', rate: 60 }; // J&K, HP, Punjab
  if (northStart >= 50 && northStart <= 77) return { zone: 'North India', rate: 60 }; // UP, Uttarakhand, Delhi, Haryana, Rajasthan

  // Default: Central & South
  return { zone: 'Central & South India', rate: 100 };
}

function openCheckout() {
  if (!TAVUSHA.cart.length) { showToast('Your bag is empty!', 'info'); return; }
  closeCart();
  // Reset screens
  document.getElementById('checkoutForm').style.display = 'block';
  document.getElementById('checkoutPayment').style.display = 'none';
  document.getElementById('checkoutSuccess').style.display = 'none';
  // Pre-fill order summary
  updateCheckoutSummary();
  // Show overlay
  const overlay = document.getElementById('checkoutOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('open'), 10);
  // Bind pincode input
  const pinInput = document.getElementById('coPincode');
  if (pinInput) {
    pinInput._bound = true;
    pinInput.oninput = () => {
      if (pinInput.value.length === 6) updateCheckoutSummary(pinInput.value);
    };
  }
}

function closeCheckout() {
  const overlay = document.getElementById('checkoutOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.style.display = 'none', 300);
  }
}

function updateCheckoutSummary(pin = '') {
  const subtotal = TAVUSHA.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalPieces = TAVUSHA.cart.reduce((s, i) => s + i.qty, 0);
  const { zone, rate } = pin.length === 6 ? calcShippingRate(pin) : { zone: '—', rate: 0 };
  const shipping = pin.length === 6 ? (rate * totalPieces) : 0;
  const tax      = Math.round(subtotal * 0.05);
  const total    = subtotal + shipping + tax;

  document.getElementById('coSubtotal').textContent    = `₹${subtotal.toLocaleString('en-IN')}`;
  document.getElementById('coShippingZone').textContent = zone;
  document.getElementById('coShipping').textContent    = pin.length === 6 ? `₹${shipping.toLocaleString('en-IN')}` : 'Enter PIN';
  if (document.getElementById('coTax')) document.getElementById('coTax').textContent = `₹${tax.toLocaleString('en-IN')}`;
  document.getElementById('coTotal').textContent       = pin.length === 6 ? `₹${total.toLocaleString('en-IN')}` : '—';

  // Auto-fill city placeholder using known prefix->city map
  if (pin.length === 6) {
    const cityGuess = guessCityFromPin(pin);
    const cityEl = document.getElementById('coCity');
    if (cityEl && cityGuess) cityEl.value = cityGuess;
  }
}

function guessCityFromPin(pin) {
  const p2 = pin.slice(0, 2);
  const p3 = pin.slice(0, 3);
  const map = {
    '110': 'New Delhi', '400': 'Mumbai', '700': 'Kolkata', '600': 'Chennai',
    '500': 'Hyderabad', '560': 'Bangalore', '380': 'Ahmedabad', '411': 'Pune',
    '302': 'Jaipur', '226': 'Lucknow', '201': 'Noida', '122': 'Gurugram',
    '160': 'Chandigarh', '380001': 'Ahmedabad',
  };
  return map[p3] || map[p2] || '';
}

// Shared state for payment flow
let _pendingOrder = null;

async function placeOrder() {
  const name    = document.getElementById('coName')?.value?.trim();
  const phone   = document.getElementById('coPhone')?.value?.trim();
  const address = document.getElementById('coAddress')?.value?.trim();
  const pin     = document.getElementById('coPincode')?.value?.trim();
  const email   = document.getElementById('coEmail')?.value?.trim();

  if (!name || !phone || !address || !pin) {
    showToast('Please fill in all required fields.', 'error'); return;
  }
  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    showToast('Enter a valid 6-digit PIN code.', 'error'); return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showToast('Enter a valid 10-digit phone number.', 'error'); return;
  }

  const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || 'cod';
  const btn = document.querySelector('#checkoutForm button.quick-view__add');
  if (btn) { btn.disabled = true; btn.textContent = 'Initiating Payment...'; }

  const subtotal    = TAVUSHA.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalPieces = TAVUSHA.cart.reduce((s, i) => s + i.qty, 0);
  const tax         = Math.round(subtotal * 0.12);
  const { zone, rate } = calcShippingRate(pin);
  const shipping    = rate * totalPieces;
  const total       = subtotal + shipping + tax;
  const advanceAmt  = paymentType === 'cod' ? Math.ceil(total * 0.20) : total;
  const orderNum    = 'TV' + Date.now().toString().slice(-8);

  _pendingOrder = {
    orderNum, name, phone, email, address, pin, zone,
    items: [...TAVUSHA.cart], subtotal, shipping, tax, total,
    paymentType, advanceAmt
  };

  const orderPayload = {
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    delivery_address: address,
    pincode: pin,
    payment_type: paymentType,
    items: TAVUSHA.cart.map(i => ({
      id: i.id,
      title: i.title || i.name,
      price: i.price,
      qty: i.qty,
      size: i.size || '',
      color: i.color || ''
    }))
  };

  let backendRazorpayOptions = null;
  let backendOrder = null;

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.razorpay) {
        backendRazorpayOptions = data.razorpay;
        backendOrder = data.order;
      }
    }
  } catch (err) {
    console.warn('Backend order call notice (falling back to direct Razorpay):', err.message);
  }

  // ─── Lazy-load Razorpay SDK on demand ────────────────────────
  const launchPayment = async (rzpOptions) => {
    if (typeof Razorpay === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const rzp = new Razorpay(rzpOptions);
    rzp.on('payment.failed', function (response) {
      showToast(`Payment failed: ${response.error.description || 'Transaction declined'}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
    });
    rzp.open();
    if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
  };

  // ─── 1. Launch Razorpay Checkout ─────────────────────────────
  try {
    const rzpOptions = backendRazorpayOptions ? {
      ...backendRazorpayOptions,
      handler: async function (response) {
        showToast('Verifying payment...', 'info');
        try {
          const verifyRes = await fetch(`${API_BASE}/orders/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          showOrderSuccessScreen(verifyData.order || backendOrder || _pendingOrder);
        } catch (err) {
          showOrderSuccessScreen(backendOrder || _pendingOrder);
        }
      },
      modal: {
        ondismiss: function() {
          showToast('Payment popup closed.', 'info');
          if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
        }
      }
    } : {
      key: 'rzp_live_TOvV4T3ysyVNwr',
      amount: Math.round(advanceAmt * 100),
      currency: 'INR',
      name: 'TAVUSHA',
      description: `Order ${orderNum} — ${paymentType === 'cod' ? '20% Advance' : 'Full Payment'}`,
      prefill: { name, contact: phone, email: email || '' },
      theme: { color: '#1a1a1a' },
      handler: function (response) {
        showToast('Payment received! Finalizing order...', 'info');
        showOrderSuccessScreen(_pendingOrder);
      },
      modal: {
        ondismiss: function() {
          showToast('Payment popup closed.', 'info');
          if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
        }
      }
    };

    await launchPayment(rzpOptions);
    return;
  } catch (rzpErr) {
    console.error('Razorpay error:', rzpErr);
  }

  // ─── 2. Fallback to UPI QR (only if Razorpay SDK blocked by ad-blocker) ──
  if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
  const qrImg = document.getElementById('qrImg');
  if (qrImg) {
    const upiData = encodeURIComponent(`upi://pay?pa=tavusha@okaxis&pn=TAVUSHA&am=${advanceAmt}&cu=INR&tn=Order+${orderNum}`);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${upiData}`;
  }

  const prompt = document.getElementById('paymentPrompt');
  if (prompt) {
    prompt.innerHTML = paymentType === 'cod'
      ? `COD Order — Pay <strong>₹${advanceAmt.toLocaleString('en-IN')}</strong> (20% advance) via UPI QR below.<br/>Remaining ₹${(total - advanceAmt).toLocaleString('en-IN')} to be paid on delivery.`
      : `Full Prepaid — Pay <strong>₹${advanceAmt.toLocaleString('en-IN')}</strong> via UPI QR below.`;
  }

  document.getElementById('checkoutForm').style.display    = 'none';
  document.getElementById('checkoutPayment').style.display = 'block';
}

function showOrderSuccessScreen(order) {
  document.getElementById('successOrderNum').textContent = order.order_number || order.orderNum || ('TV' + Date.now().toString().slice(-8));
  document.getElementById('successName').textContent     = order.customer_name || order.name || '';
  const paidVal = order.advance_required || order.advance_paid || order.total || order.total_amount || 0;
  document.getElementById('successPaid').textContent     = `₹${Number(paidVal).toLocaleString('en-IN')} ${order.payment_type === 'cod' ? '(Advance paid)' : '(Full payment)'}`;
  document.getElementById('checkoutForm').style.display    = 'none';
  document.getElementById('checkoutPayment').style.display = 'none';
  document.getElementById('checkoutSuccess').style.display = 'block';
  clearCart();
}

async function simulatePaymentCapture() {
  if (!_pendingOrder) return;
  const { orderNum, name, phone, email, address, pin, zone, items, subtotal, shipping, tax, total, paymentType, advanceAmt } = _pendingOrder;

  const orderData = {
    order_number: orderNum,
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    delivery_address: address + ', PIN ' + pin,
    shipping_zone: zone,
    items: JSON.stringify(items),
    subtotal,
    shipping_charge: shipping,
    tax_amount: tax,
    total_amount: total,
    payment_type: paymentType,
    advance_paid: advanceAmt,
    payment_status: 'paid',
    status: 'confirmed',
    created_at: new Date().toISOString()
  };

  try {
    await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
  } catch {
    const orders = JSON.parse(localStorage.getItem('tavusha_orders') || '[]');
    orders.push(orderData);
    localStorage.setItem('tavusha_orders', JSON.stringify(orders));
  }

  showOrderSuccessScreen(orderData);
  _pendingOrder = null;
}

function clearCart() {
  TAVUSHA.cart = [];
  saveCart();
  updateCartUI();
}

// ─── CMS / BANNER LOADER ──────────────────────────────────────
async function loadCmsContent() {
  let cms = null;

  // Try live API first
  try {
    const res = await fetch(`${API_BASE}/cms/public`);
    if (res.ok) cms = await res.json();
  } catch { /* backend offline */ }

  if (!cms) cms = {};

  // Check localStorage for admin overrides / offline data
  let localCms = null;
  try {
    const stored = localStorage.getItem('cms_data');
    if (stored) localCms = JSON.parse(stored);
  } catch (e) {}

  let demoSecs = null;
  try {
    const storedSecs = localStorage.getItem('sp_demo_sections');
    if (storedSecs) demoSecs = JSON.parse(storedSecs);
  } catch (e) {}

  let demoBanners = null;
  try {
    const storedBanners = localStorage.getItem('sp_demo_banners');
    if (storedBanners) demoBanners = JSON.parse(storedBanners);
  } catch (e) {}

  // Merge sections from all available sources
  let sectionsMap = {};

  // 1. Live API sections
  if (cms.sections) {
    const list = Array.isArray(cms.sections) ? cms.sections : Object.entries(cms.sections).map(([key, s]) => ({ key, ...s }));
    list.forEach(s => { sectionsMap[s.key] = s; });
  }

  // 2. Local CMS cache
  if (localCms && localCms.sections) {
    const list = Array.isArray(localCms.sections) ? localCms.sections : Object.entries(localCms.sections).map(([key, s]) => ({ key, ...s }));
    list.forEach(s => {
      sectionsMap[s.key] = { ...(sectionsMap[s.key] || {}), ...s };
    });
  }

  // 3. Admin demo section updates
  if (demoSecs && Array.isArray(demoSecs)) {
    demoSecs.forEach(ds => {
      sectionsMap[ds.key] = { ...(sectionsMap[ds.key] || {}), ...ds };
    });
  }

  cms.sections = Object.values(sectionsMap);
  if (!cms.announcement && localCms?.announcement) cms.announcement = localCms.announcement;

  const DEFAULT_SITE_BANNERS = [
    { id: 'b1', type: 'hero', title: 'Style Every Moment', subtitle: 'Discover curated elegance and edge.', badge_text: 'New Summer 2026', cta_text: 'Shop Now', cta_url: '#', image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900', visible: true, sort_order: 0 },
    { id: 'b2', type: 'festival', title: 'Rakhi Celebrations Live', subtitle: 'Flat 10% Off First Order — Code TAVUSHA10', badge_text: 'Festival Special', cta_text: 'Explore Sale', cta_url: '#', image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900', visible: true, sort_order: 1, festival_tag: 'Rakhi' }
  ];

  // Resolve banners (demoBanners -> localCms -> API -> DEFAULT_SITE_BANNERS)
  let allBanners = (demoBanners && demoBanners.length) ? demoBanners :
                   (localCms?.banners && localCms.banners.length) ? localCms.banners :
                   (cms.banners && cms.banners.length) ? cms.banners :
                   DEFAULT_SITE_BANNERS;

  const heroBanners = allBanners.filter(b => b.visible !== false && (b.type === 'hero' || !b.type));
  const festBanners = allBanners.filter(b => b.visible !== false && b.type === 'festival');

  // Announcement bar text
  if (cms.announcement) {
    const bar = document.getElementById('announcement');
    if (bar) {
      const textEl = bar.querySelector('.announcement__text');
      const annText = typeof cms.announcement === 'string' 
        ? cms.announcement 
        : (cms.announcement.config?.text || cms.announcement.text || '');
      if (textEl && annText) textEl.textContent = annText;
    }
  }

  // Hero banners rendering — use banners resolved above, falling back to cms.heroBanners
  const cmsHeroBanners = heroBanners.length ? heroBanners : (cms.heroBanners || (Array.isArray(cms.banners) ? cms.banners.filter(b => b.type === 'hero' || !b.type) : []) || []);
  if (cmsHeroBanners && cmsHeroBanners.length) {
    const heroBanner = cmsHeroBanners[0];
    const heroImg = document.querySelector('.hero__model-img');
    if (heroImg && heroBanner.image_url) {
      const fixedImg = typeof fixDriveUrl === 'function' ? fixDriveUrl(heroBanner.image_url) : heroBanner.image_url;
      heroImg.src = fixedImg;
      heroImg.alt = heroBanner.title || 'TAVUSHA Hero Banner';
    }
    if (heroBanner.title) {
      const displayEl = document.querySelector('.hero__display');
      if (displayEl) displayEl.innerHTML = heroBanner.title;
    }
    if (heroBanner.subtitle) {
      const taglineEl = document.querySelector('.hero__tagline');
      if (taglineEl) taglineEl.textContent = heroBanner.subtitle;
    }
    if (heroBanner.badge_text) {
      const badgeEl = document.querySelector('.hero__badge');
      if (badgeEl) {
        badgeEl.innerHTML = `<span class="hero__badge-dot"></span> ${heroBanner.badge_text}`;
      }
    }
    if (heroBanner.cta_text || heroBanner.cta_url) {
      const ctaBtn = document.querySelector('.hero__cta-row button');
      if (ctaBtn) {
        if (heroBanner.cta_text) {
          ctaBtn.innerHTML = `${heroBanner.cta_text} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 14 0M12 5l7 7-7 7"/></svg>`;
        }
        if (heroBanner.cta_url && heroBanner.cta_url !== '#') {
          ctaBtn.setAttribute('onclick', `window.location.href='${heroBanner.cta_url}'`);
        }
      }
    }
  }

  // Festival / promo banners — inject into page if container exists
  const cmsFestBanners = festBanners.length ? festBanners : (cms.festivalBanners || (Array.isArray(cms.banners) ? cms.banners.filter(b => b.type === 'festival') : []) || []);
  if (cmsFestBanners && cmsFestBanners.length) {
    renderFestivalBanners(cmsFestBanners);
  }

  // Section visibility & dynamic configurations
  if (cms.sections) {
    const list = Array.isArray(cms.sections) ? cms.sections : Object.entries(cms.sections).map(([key, s]) => ({ key, visible: s.visible, config: s.config }));
    list.forEach(s => {
      let id = s.key;
      // Map section keys to actual element IDs if needed
      if (id === 'poster_spread') id = 'poster-spread';
      if (id === 'categories') id = 'cat-browser';
      if (id === 'testimonials') id = 'reviews';
      
      const el = document.getElementById(id);
      if (el) el.style.display = s.visible !== false ? '' : 'none';
      
      // Load campaign poster contents if this is the poster spread section
      const isPoster = (s.key === 'poster_spread' || s.key === 'poster-spread');
      if (isPoster && s.visible !== false && s.config) {
        let cfg = s.config;
        if (typeof cfg === 'string') {
          try { cfg = JSON.parse(cfg); } catch (e) {}
        }
        if (typeof cfg === 'object' && cfg !== null) {
          const getImgUrl = (url) => {
            if (!url) return '';
            if (typeof fixDriveUrl === 'function') return fixDriveUrl(url);
            var m = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/) || url.match(/\/d\/([^/]+)/);
            return (m && m[1]) ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800' : url;
          };

          const elEyebrow = document.getElementById('p_spread_eyebrow');
          if (elEyebrow && cfg.eyebrow) elEyebrow.textContent = cfg.eyebrow;
          
          const elTitle = document.getElementById('p_spread_title');
          if (elTitle && cfg.title) elTitle.textContent = cfg.title;

          // Main
          const elMainImg = document.getElementById('p_spread_main_img');
          if (elMainImg && cfg.main_image) elMainImg.src = getImgUrl(cfg.main_image);
          
          const elMainBadge = document.getElementById('p_spread_main_badge');
          if (elMainBadge && cfg.main_badge) elMainBadge.textContent = cfg.main_badge;
          
          const elMainTitle = document.getElementById('p_spread_main_title');
          if (elMainTitle && cfg.main_title) elMainTitle.textContent = cfg.main_title;
          
          const elMainDesc = document.getElementById('p_spread_main_desc');
          if (elMainDesc && cfg.main_desc) elMainDesc.textContent = cfg.main_desc;
          
          const elMainAction = document.getElementById('p_spread_main_action');
          if (elMainAction && cfg.main_link) {
            const targetUrl = cfg.main_link.startsWith('http') || cfg.main_link.includes('.html') 
              ? cfg.main_link 
              : `product.html?id=${cfg.main_link}`;
            elMainAction.setAttribute('onclick', `window.location.href='${targetUrl}'`);
          }

          // Side 1
          const elSide1Img = document.getElementById('p_spread_side1_img');
          if (elSide1Img && cfg.side1_image) elSide1Img.src = getImgUrl(cfg.side1_image);
          
          const elSide1Badge = document.getElementById('p_spread_side1_badge');
          if (elSide1Badge && cfg.side1_badge) elSide1Badge.textContent = cfg.side1_badge;
          
          const elSide1Title = document.getElementById('p_spread_side1_title');
          if (elSide1Title && cfg.side1_title) elSide1Title.textContent = cfg.side1_title;
          
          const elSide1Quote = document.getElementById('p_spread_side1_quote');
          if (elSide1Quote && cfg.side1_quote) elSide1Quote.textContent = cfg.side1_quote;
          
          const elSide1Action = document.getElementById('p_spread_side1_action');
          if (elSide1Action && cfg.side1_link) {
            const targetUrl = cfg.side1_link.startsWith('http') || cfg.side1_link.includes('.html') 
              ? cfg.side1_link 
              : `product.html?id=${cfg.side1_link}`;
            elSide1Action.setAttribute('onclick', `window.location.href='${targetUrl}'`);
          }

          // Side 2
          const elSide2Img = document.getElementById('p_spread_side2_img');
          if (elSide2Img && cfg.side2_image) elSide2Img.src = getImgUrl(cfg.side2_image);
          
          const elSide2Badge = document.getElementById('p_spread_side2_badge');
          if (elSide2Badge && cfg.side2_badge) elSide2Badge.textContent = cfg.side2_badge;
          
          const elSide2Title = document.getElementById('p_spread_side2_title');
          if (elSide2Title && cfg.side2_title) elSide2Title.textContent = cfg.side2_title;
          
          const elSide2Quote = document.getElementById('p_spread_side2_quote');
          if (elSide2Quote && cfg.side2_quote) elSide2Quote.textContent = cfg.side2_quote;
          
          const elSide2Action = document.getElementById('p_spread_side2_action');
          if (elSide2Action && cfg.side2_link) {
            const targetUrl = cfg.side2_link.startsWith('http') || cfg.side2_link.includes('.html') 
              ? cfg.side2_link 
              : `product.html?id=${cfg.side2_link}`;
            elSide2Action.setAttribute('onclick', `window.location.href='${targetUrl}'`);
          }

          // Quote Box
          const elQuoteText = document.getElementById('p_spread_quote_text');
          if (elQuoteText && cfg.quote_text) elQuoteText.textContent = cfg.quote_text;
          
          const elQuoteAuthor = document.getElementById('p_spread_quote_author');
          if (elQuoteAuthor && cfg.quote_author) elQuoteAuthor.textContent = cfg.quote_author;
        }
      }

      // Load Customer Feedback / Testimonials config
      if ((s.key === 'testimonials' || s.key === 'reviews') && s.visible !== false && s.config) {
        renderCustomerFeedback(s.config);
      }
    });
  }

  // Promo popup
  if (cms.popup && cms.popup.enabled) {
    setTimeout(() => showCmsPopup(cms.popup), (cms.popup.delay || 5) * 1000);
  }
}

function handleLinkNavigation(url) {
  if (!url || url === '#') return;
  if (url.startsWith('#')) {
    const target = document.querySelector(url);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  } else {
    window.location.href = url;
  }
}

function renderCustomerFeedback(cfg) {
  if (!cfg) return;
  const titleEl = document.getElementById('reviews_section_title');
  if (titleEl && cfg.title) titleEl.innerHTML = cfg.title;

  const subEl = document.getElementById('reviews_section_sub');
  if (subEl && cfg.sub) subEl.textContent = cfg.sub;

  const scoreEl = document.getElementById('reviews_avg_score');
  if (scoreEl && cfg.rating) scoreEl.textContent = cfg.rating;

  const countEl = document.getElementById('reviews_total_count');
  if (countEl && cfg.count) countEl.textContent = cfg.count;

  if (Array.isArray(cfg.reviews) && cfg.reviews.length > 0) {
    const grid = document.getElementById('reviewsGridContainer');
    if (grid) {
      grid.innerHTML = cfg.reviews.map((r, i) => {
        const starsCount = Number(r.stars) || 5;
        const starsHTML = Array.from({length: 5}, (_, idx) => 
          `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity="${idx < starsCount ? '1' : '0.3'}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        ).join('');
        const initial = (r.name || 'C').charAt(0).toUpperCase();

        return `
          <div class="review-card-ref reveal delay-${(i % 4) + 1}">
            <div class="review-card-ref__stars">
              ${starsHTML}
            </div>
            <p class="review-card-ref__text">"${r.text || ''}"</p>
            <div class="review-card-ref__author">
              <div class="review-card-ref__avatar">${r.avatar || initial}</div>
              <div>
                <div class="review-card-ref__name">${r.name || 'Anonymous Customer'}</div>
                <div class="review-card-ref__tag">${r.tag || '✓ Verified Purchase'}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      if (typeof reInitReveal === 'function') reInitReveal(grid);
    }
  }
}

function renderFestivalBanners(banners) {
  let container = document.getElementById('festivalBannersSection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'festivalBannersSection';
    container.style.cssText = 'padding:20px 0; overflow:hidden;';
    const target = document.getElementById('cat-browser') || document.querySelector('.marquee-ribbon');
    if (target) target.before(container);
    else document.body.appendChild(container);
  }

  container.innerHTML = `
    <div style="display:flex; gap:16px; padding:0 40px; overflow-x:auto; scroll-snap-type:x mandatory;">
      ${banners.map(b => {
        const hasLink = b.cta_url && b.cta_url !== '#';
        const urlStr = hasLink ? b.cta_url.replace(/'/g, "\\'") : '';
        return `
        <div onclick="${hasLink ? `handleLinkNavigation('${urlStr}')` : ''}"
             style="min-width:280px; border-radius:16px; overflow:hidden; cursor:${hasLink ? 'pointer' : 'default'};
                    background:linear-gradient(135deg,#1a0a2e,#5c1e4a); flex-shrink:0; scroll-snap-align:start;
                    display:flex; align-items:center; gap:16px; padding:20px; color:#fff; position:relative; transition: transform 0.2s ease, box-shadow 0.2s ease;"
             onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)';"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
          ${b.image_url ? `<img src="${b.image_url}" style="width:80px; height:80px; object-fit:cover; border-radius:10px; flex-shrink:0" alt="${b.title || 'Festival Banner'}">` : ''}
          <div>
            <div style="font-size:0.65rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7; margin-bottom:4px">${b.festival_tag || b.badge_text || 'Limited Offer'}</div>
            <div style="font-size:1.1rem; font-weight:700; margin-bottom:4px">${b.title || ''}</div>
            ${b.subtitle ? `<div style="font-size:0.8rem; opacity:0.85">${b.subtitle}</div>` : ''}
            ${hasLink ? `<div style="font-size:0.75rem; font-weight:600; text-decoration:underline; margin-top:6px; opacity:0.95">${b.cta_text || 'Shop Now →'}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function showCmsPopup(popup) {
  let el = document.getElementById('cmsPopupOverlay');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'cmsPopupOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:36px;max-width:400px;width:90%;text-align:center;position:relative;box-shadow:0 32px 80px rgba(0,0,0,0.2)">
      <button onclick="document.getElementById('cmsPopupOverlay').remove()"
              style="position:absolute;top:12px;right:16px;background:none;border:none;cursor:pointer;font-size:1.4rem;color:#888">&times;</button>
      ${popup.image_url ? `<img src="${popup.image_url}" style="width:100%;border-radius:12px;margin-bottom:16px;object-fit:cover;max-height:180px">` : ''}
      <h3 style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;margin-bottom:8px">${popup.title || ''}</h3>
      <p style="font-size:0.88rem;color:var(--warm-grey);margin-bottom:20px">${popup.body || ''}</p>
      ${popup.cta_label ? `<a href="${popup.cta_url || '#'}" class="btn-pill btn-pill--gold" style="padding:10px 28px;font-size:0.8rem;display:inline-block">${popup.cta_label}</a>` : ''}
    </div>`;
  document.body.appendChild(el);
}

// Load CMS on page boot
document.addEventListener('DOMContentLoaded', loadCmsContent);

// ─── Backend warm-up ping ─────────────────────────────────────
// Render free-tier servers spin down after inactivity.
// Ping on page load so the server is warm by the time the user
// reaches checkout (avoids silent fetch failures → QR fallback).
document.addEventListener('DOMContentLoaded', function() {
  fetch(API_BASE + '/health', {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  }).catch(() => {
    // Server is warming up — silently ignore, it will be ready by checkout
    console.info('[Tavusha] Backend warming up...');
  });
});

// ─── Razorpay SDK load check ──────────────────────────────────
window.addEventListener('load', function() {
  if (typeof Razorpay === 'undefined') {
    console.warn('[Tavusha] ⚠️ Razorpay SDK did not load. Possible causes: ad-blocker, network error, or CSP restriction.');
  }
});
