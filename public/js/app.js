import { StudioScene } from './studio-scene.js';
import { DICT, SHOE_COPY_EN } from './i18n.js';

const STUDIO_SWATCHES = [
  { name: 'Sail White', hex: '#F4F1EA' },
  { name: 'Pure Chalk', hex: '#F8F7F4' },
  { name: 'Obsidian', hex: '#181816' },
  { name: 'Cool Grey', hex: '#888C91' },
  { name: 'Infrared Red', hex: '#E63E26' },
  { name: 'Crimson 85', hex: '#B82924' },
  { name: 'Varsity Royal', hex: '#1F50A6' },
  { name: 'University Sky', hex: '#4F87C6' },
  { name: 'Volt Lime', hex: '#4CE0B3' },
  { name: 'Forest Pine', hex: '#214933' },
  { name: 'Mocha Suede', hex: '#5A4232' },
  { name: 'Gum Tan', hex: '#9E764E' }
];

const THEMES = ['gelap', 'pekat', 'terang'];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function formatIdr(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

function createShoeCardSvg(shoe) {
  const cw = shoe.colorways[0];
  const arch = shoe.architecture;
  const isHigh = arch.collarHeight >= 1.25;
  const isMid = arch.collarHeight >= 1.05 && arch.collarHeight < 1.25;

  const collarTopY = isHigh ? 14 : isMid ? 22 : 30;
  const heelTopY = isHigh ? 18 : isMid ? 26 : 33;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 100');
  svg.setAttribute('class', 'card-shoe-svg');
  svg.setAttribute('aria-hidden', 'true');

  const upperPath = `M 28 ${heelTopY} Q 48 ${collarTopY + 12} 76 ${collarTopY + 10} L 116 48 Q 162 54 192 66 Q 198 73 192 78 L 26 78 Q 22 56 28 ${heelTopY} Z`;
  const heelOverlay = `M 26 78 Q 22 56 28 ${heelTopY} L 54 ${heelTopY + 8} Q 52 60 66 78 Z`;
  const toeOverlay = `M 152 58 Q 178 60 192 66 Q 198 73 192 78 L 146 78 Q 146 66 152 58 Z`;
  const midsolePath = `M 24 77 L 194 77 Q 198 83 192 87 L 26 87 Q 21 82 24 77 Z`;
  const outsolePath = `M 25 86 L 192 86 L 190 91 L 26 91 Z`;
  const swooshPath = `M 148 64 Q 112 72 86 64 Q 68 58 46 46 Q 74 70 108 72 Q 134 73 154 62 Z`;

  const makePath = (d, fill, stroke = 'none') => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fill);
    if (stroke !== 'none') {
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', '1.4');
    }
    return p;
  };

  svg.append(
    makePath(upperPath, cw.upper, '#111622'),
    makePath(heelOverlay, cw.overlay, '#111622'),
    makePath(toeOverlay, cw.overlay, '#111622'),
    makePath(midsolePath, cw.midsole, '#111622'),
    makePath(outsolePath, cw.outsole),
    makePath(swooshPath, cw.accent)
  );

  if (arch.airUnitStyle === 'heel' || arch.airUnitStyle === 'full') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', arch.airUnitStyle === 'full' ? '40' : '38');
    rect.setAttribute('y', '80');
    rect.setAttribute('width', arch.airUnitStyle === 'full' ? '92' : '24');
    rect.setAttribute('height', '4.5');
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', cw.accent);
    svg.appendChild(rect);
  }

  return svg;
}

const state = {
  lang: 'id',
  shoes: [],
  filteredShoes: [],
  activeCategory: 'all',
  selectedShoe: null,
  activeColorwayName: 'Infrared 90',
  activeZone: 'upper',
  colors: {
    upper: '#ECEAE4',
    overlay: '#302F2D',
    midsole: '#F7F5F0',
    outsole: '#181816',
    accent: '#E63E26',
    laces: '#F7F5F0'
  },
  material: 'knit',
  selectedSize: null,
  bag: [],
  designs: [],
  theme: 'gelap'
};

let studio = null;

const els = {
  html: document.documentElement,
  langBtns: document.querySelectorAll('.lang-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  themeLabel: document.getElementById('theme-label'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  mobileNavPanel: document.getElementById('mobile-nav-panel'),
  canvasWrap: document.getElementById('shoe-canvas-wrap'),
  webglFallback: document.getElementById('webgl-fallback'),
  webglFallbackMsg: document.getElementById('webgl-fallback-msg'),
  toggleRotateBtn: document.getElementById('toggle-rotate-btn'),
  toggleExplodeBtn: document.getElementById('toggle-explode-btn'),
  camBtns: document.querySelectorAll('.cam-btn'),

  heroCategory: document.getElementById('hero-category'),
  heroTag: document.getElementById('hero-tag'),
  heroTitle: document.getElementById('hero-title'),
  heroSummary: document.getElementById('hero-summary'),
  heroChipStack: document.getElementById('hero-chip-stack'),
  heroChipDrop: document.getElementById('hero-chip-drop'),
  heroPrice: document.getElementById('hero-price'),
  heroColorwayName: document.getElementById('hero-colorway-name'),
  heroColorwayChips: document.getElementById('hero-colorway-chips'),
  lineupCounter: document.getElementById('lineup-counter'),
  lineupProgress: document.getElementById('lineup-progress'),
  prevShoeBtn: document.getElementById('prev-shoe-btn'),
  nextShoeBtn: document.getElementById('next-shoe-btn'),

  zoneTabs: document.querySelectorAll('.zone-tab'),
  activeZoneLabel: document.getElementById('active-zone-label'),
  zoneColorInput: document.getElementById('zone-color-input'),
  paletteSwatches: document.getElementById('palette-swatches'),
  matBtns: document.querySelectorAll('.mat-btn'),
  resetColorwayBtn: document.getElementById('reset-colorway-btn'),
  saveDesignForm: document.getElementById('save-design-form'),
  buildNameInput: document.getElementById('build-name-input'),
  saveDesignFeedback: document.getElementById('save-design-feedback'),

  refreshDesignsBtn: document.getElementById('refresh-designs-btn'),
  retryDesignsBtn: document.getElementById('retry-designs-btn'),
  designsLoading: document.getElementById('designs-loading'),
  designsError: document.getElementById('designs-error'),
  designsErrorMsg: document.getElementById('designs-error-msg'),
  designsEmpty: document.getElementById('designs-empty'),
  designsList: document.getElementById('designs-list'),

  filterBtns: document.querySelectorAll('.filter-btn'),
  catalogLoading: document.getElementById('catalog-loading'),
  catalogError: document.getElementById('catalog-error'),
  catalogErrorMsg: document.getElementById('catalog-error-msg'),
  retryCatalogBtn: document.getElementById('retry-catalog-btn'),
  catalogEmpty: document.getElementById('catalog-empty'),
  catalogWorkbench: document.getElementById('catalog-workbench'),
  shoeSelectorList: document.getElementById('shoe-selector-list'),
  selectedCatBadge: document.getElementById('selected-cat-badge'),
  selectedShoeName: document.getElementById('selected-shoe-name'),
  selectedShoePrice: document.getElementById('selected-shoe-price'),
  specHeel: document.getElementById('spec-heel'),
  specDrop: document.getElementById('spec-drop'),
  specColorway: document.getElementById('spec-colorway'),
  sizeGrid: document.getElementById('size-grid'),
  sizeStockNote: document.getElementById('size-stock-note'),
  addToBagBtn: document.getElementById('add-to-bag-btn'),
  bagFeedback: document.getElementById('bag-feedback'),

  matDescUpper: document.getElementById('mat-desc-upper'),
  matDescMidsole: document.getElementById('mat-desc-midsole'),
  matDescOutsole: document.getElementById('mat-desc-outsole'),
  inspectLayerBtns: document.querySelectorAll('.inspect-layer-btn'),

  openBagBtn: document.getElementById('open-bag-btn'),
  bagCount: document.getElementById('bag-count'),
  bagDialog: document.getElementById('bag-dialog'),
  closeBagBtn: document.getElementById('close-bag-btn'),
  bagEmptyState: document.getElementById('bag-empty-state'),
  bagGoCatalog: document.getElementById('bag-go-catalog'),
  bagItemsList: document.getElementById('bag-items-list'),
  checkoutForm: document.getElementById('checkout-form'),
  bagTotalPrice: document.getElementById('bag-total-price'),
  customerName: document.getElementById('customer-name'),
  customerEmail: document.getElementById('customer-email'),
  shippingAddress: document.getElementById('shipping-address'),
  checkoutFeedback: document.getElementById('checkout-feedback'),
  submitOrderBtn: document.getElementById('submit-order-btn'),
  orderReceipt: document.getElementById('order-receipt'),
  receiptOrderId: document.getElementById('receipt-order-id'),
  receiptSummary: document.getElementById('receipt-summary'),
  receiptDoneBtn: document.getElementById('receipt-done-btn')
};

function t() {
  return DICT[state.lang] || DICT.id;
}

function getShoeText(shoe) {
  if (state.lang === 'en' && SHOE_COPY_EN[shoe.id]) {
    return SHOE_COPY_EN[shoe.id];
  }
  return { summary: shoe.summary, materials: shoe.materials };
}

function animateTextSwap(el, nextText, delayMs = 0) {
  if (!el) return;
  if (el.textContent === nextText) return;
  el.textContent = nextText;
  if (prefersReducedMotion) return;

  el.classList.remove('text-swap-in');
  el.style.animationDelay = delayMs ? `${delayMs}ms` : '';
  void el.offsetWidth;
  el.classList.add('text-swap-in');
}

function applyLanguage(nextLang) {
  const valid = nextLang === 'en' ? 'en' : 'id';
  state.lang = valid;
  const copy = t();

  els.html.setAttribute('lang', valid);
  document.title = copy.pageTitle;

  els.langBtns.forEach((btn) => {
    const active = btn.dataset.lang === valid;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (typeof copy[key] === 'string') {
      node.textContent = copy[key];
    }
  });

  document.querySelectorAll('[data-i18n-zone]').forEach((node) => {
    const z = node.dataset.i18nZone;
    if (copy.zoneLabels[z]) {
      node.textContent = copy.zoneLabels[z];
    }
  });

  // Update dynamic placeholders & aria-labels
  els.buildNameInput.placeholder = copy.buildPlaceholder;
  els.customerName.placeholder = copy.custNamePlaceholder;
  els.customerEmail.placeholder = copy.custEmailPlaceholder;
  els.shippingAddress.placeholder = copy.custAddressPlaceholder;
  els.openBagBtn.setAttribute('aria-label', copy.bagAria);
  els.closeBagBtn.setAttribute('aria-label', copy.bagCloseAria);
  document.querySelector('.skip-link').textContent = copy.skipLink;

  if (studio) {
    els.toggleRotateBtn.textContent = studio.autoRotate ? copy.pauseSpin : copy.autoSpin;
    els.toggleExplodeBtn.textContent = studio.exploded ? copy.assembleLayers : copy.explodeLayers;
  } else {
    els.toggleRotateBtn.textContent = copy.pauseSpin;
    els.toggleExplodeBtn.textContent = copy.explodeLayers;
  }

  applyTheme(state.theme);
  renderPaletteSwatches();
  renderShoeSelectorList();
  renderShoeDetails();
  renderDesignsList();
  updateBagUI();

  try {
    localStorage.setItem('kineta_lang', valid);
  } catch {
    // Ignore storage errors
  }
}

function initLanguage() {
  let saved = 'id';
  try {
    const stored = localStorage.getItem('kineta_lang');
    if (stored === 'en' || stored === 'id') saved = stored;
  } catch {
    saved = 'id';
  }
  state.lang = saved;
}

function applyTheme(nextTheme) {
  const valid = THEMES.includes(nextTheme) ? nextTheme : 'gelap';
  state.theme = valid;
  const copy = t();
  els.html.setAttribute('data-theme', valid);
  els.themeLabel.textContent = copy.themeLabels[valid];
  const nextIndex = (THEMES.indexOf(valid) + 1) % THEMES.length;
  const nextLabel = copy.themeLabels[THEMES[nextIndex]];
  els.themeToggle.setAttribute(
    'aria-label',
    state.lang === 'en'
      ? `Active theme: ${copy.themeLabels[valid]}. Click to switch to ${nextLabel}`
      : `Tema aktif: ${copy.themeLabels[valid]}. Klik untuk ganti ke ${nextLabel}`
  );
  try {
    localStorage.setItem('kineta_theme_v3', valid);
  } catch {
    // Ignore storage errors
  }
  if (studio) {
    studio.setTheme(valid);
  }
}

function initTheme() {
  let saved = 'gelap';
  try {
    const stored = localStorage.getItem('kineta_theme_v3');
    if (THEMES.includes(stored)) saved = stored;
  } catch {
    saved = 'gelap';
  }
  applyTheme(saved);
}

function setFeedback(el, message, type = '') {
  el.textContent = message;
  el.classList.remove('is-error', 'is-success');
  if (type === 'error') el.classList.add('is-error');
  if (type === 'success') el.classList.add('is-success');
}

function syncMaterialButtons() {
  els.matBtns.forEach((btn) => {
    const active = btn.dataset.material === state.material;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function renderPaletteSwatches() {
  const copy = t();
  const activeColor = state.colors[state.activeZone].toUpperCase();
  els.activeZoneLabel.textContent = copy.zoneLabels[state.activeZone];
  els.zoneColorInput.value = activeColor;

  els.paletteSwatches.replaceChildren();
  STUDIO_SWATCHES.forEach((swatch) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn';
    if (swatch.hex.toUpperCase() === activeColor) {
      btn.classList.add('is-selected');
    }
    btn.style.backgroundColor = swatch.hex;
    btn.setAttribute('aria-label', `${swatch.name} (${copy.zoneLabels[state.activeZone]})`);
    btn.title = swatch.name;
    btn.addEventListener('click', () => {
      state.colors[state.activeZone] = swatch.hex;
      state.activeColorwayName = copy.customColorwayName;
      updateColorwayUI();
      if (studio) studio.updateColors(state.colors);
    });
    els.paletteSwatches.appendChild(btn);
  });
}

function renderHeroColorways() {
  if (!state.selectedShoe) return;
  els.heroColorwayChips.replaceChildren();
  state.selectedShoe.colorways.forEach((cw) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'colorway-chip';
    if (state.activeColorwayName === cw.name) {
      btn.classList.add('is-active');
    }
    const dot = document.createElement('span');
    dot.className = 'chip-swatch';
    dot.style.backgroundColor = cw.overlay;
    const text = document.createElement('span');
    text.textContent = cw.name;
    btn.append(dot, text);

    btn.addEventListener('click', () => {
      state.colors = {
        upper: cw.upper,
        overlay: cw.overlay,
        midsole: cw.midsole,
        outsole: cw.outsole,
        accent: cw.accent,
        laces: cw.laces
      };
      state.activeColorwayName = cw.name;
      updateColorwayUI();
      if (studio) studio.updateColors(state.colors);
    });
    els.heroColorwayChips.appendChild(btn);
  });
}

function updateColorwayUI() {
  animateTextSwap(els.heroColorwayName, state.activeColorwayName);
  animateTextSwap(els.specColorway, state.activeColorwayName);
  renderHeroColorways();
  renderPaletteSwatches();
}

function updateLineupBar() {
  if (state.shoes.length === 0 || !state.selectedShoe) return;
  const idx = state.shoes.findIndex((s) => s.id === state.selectedShoe.id);
  const currentNum = idx >= 0 ? idx + 1 : 1;
  const total = state.shoes.length;
  els.lineupCounter.textContent = `MODEL ${String(currentNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  els.lineupProgress.style.width = `${(currentNum / total) * 100}%`;
}

function renderShoeDetails() {
  const shoe = state.selectedShoe;
  if (!shoe) return;
  const localized = getShoeText(shoe);

  animateTextSwap(els.heroCategory, shoe.category, 0);
  animateTextSwap(els.heroTag, localized.tag || shoe.tag || shoe.category, 15);
  animateTextSwap(els.heroTitle, shoe.name, 25);
  animateTextSwap(els.heroSummary, localized.summary, 45);
  animateTextSwap(els.heroPrice, formatIdr(shoe.priceIdr), 55);
  els.heroChipStack.textContent = `STACK ${shoe.architecture.heelStackMm}MM`;
  els.heroChipDrop.textContent = `DROP ${shoe.architecture.dropMm}MM`;

  animateTextSwap(els.selectedCatBadge, shoe.category, 0);
  animateTextSwap(els.selectedShoeName, shoe.name, 25);
  animateTextSwap(els.selectedShoePrice, formatIdr(shoe.priceIdr), 40);
  els.specHeel.textContent = `${shoe.architecture.heelStackMm} mm`;
  els.specDrop.textContent = `${shoe.architecture.dropMm} mm`;

  els.matDescUpper.textContent = localized.materials.upper;
  els.matDescMidsole.textContent = localized.materials.midsole;
  els.matDescOutsole.textContent = localized.materials.outsole;

  updateLineupBar();
  renderSizes();
  updateColorwayUI();
  syncMaterialButtons();
}

function renderSizes() {
  const shoe = state.selectedShoe;
  if (!shoe) return;
  const copy = t();

  els.sizeGrid.replaceChildren();
  const stillAvailable = shoe.sizes.find(
    (s) => s.eu === state.selectedSize && s.stock > 0
  );
  if (!stillAvailable) {
    state.selectedSize = null;
  }

  shoe.sizes.forEach((sizeObj) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-btn';
    btn.setAttribute('role', 'radio');
    const isSelected = state.selectedSize === sizeObj.eu;
    btn.setAttribute('aria-checked', String(isSelected));
    if (isSelected) btn.classList.add('is-selected');
    btn.textContent = `EU ${sizeObj.eu}`;
    btn.disabled = sizeObj.stock === 0;
    if (sizeObj.stock === 0) {
      btn.setAttribute('aria-label', `EU ${sizeObj.eu} sold out`);
    }

    btn.addEventListener('click', () => {
      state.selectedSize = sizeObj.eu;
      setFeedback(els.bagFeedback, '');
      renderSizes();
    });
    els.sizeGrid.appendChild(btn);
  });

  if (state.selectedSize) {
    const activeEntry = shoe.sizes.find((s) => s.eu === state.selectedSize);
    els.sizeStockNote.textContent = `${copy.sizeStockPrefix} ${activeEntry.stock} ${copy.pairsUnit}`;
    els.addToBagBtn.disabled = false;
    els.addToBagBtn.textContent = copy.addBagAction(state.selectedSize);
  } else {
    els.sizeStockNote.textContent = copy.sizePrompt;
    els.addToBagBtn.disabled = true;
    els.addToBagBtn.textContent = copy.addBagPrompt;
  }
}

function renderShoeSelectorList() {
  const copy = t();
  els.shoeSelectorList.replaceChildren();
  state.filteredShoes.forEach((shoe) => {
    const isActive = state.selectedShoe && state.selectedShoe.id === shoe.id;
    const localized = getShoeText(shoe);

    const card = document.createElement('article');
    card.className = `shoe-card${isActive ? ' is-active' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(isActive));

    const stage = document.createElement('div');
    stage.className = `shoe-card-stage tone-${shoe.stageTone || 'sky'}`;

    const topRow = document.createElement('div');
    topRow.className = 'stage-top-row';

    const pill = document.createElement('span');
    pill.className = 'stage-pill';
    pill.textContent = localized.tag || shoe.tag || shoe.category;

    const dots = document.createElement('span');
    dots.className = 'stage-dots';
    dots.setAttribute('aria-hidden', 'true');
    shoe.colorways.slice(0, 4).forEach((cw) => {
      const dot = document.createElement('span');
      dot.className = 'stage-dot';
      dot.style.backgroundColor = cw.accent;
      dots.appendChild(dot);
    });

    topRow.append(pill, dots);
    stage.append(topRow, createShoeCardSvg(shoe));

    const body = document.createElement('div');
    body.className = 'shoe-card-body';

    const cat = document.createElement('span');
    cat.className = 'shoe-card-cat';
    cat.textContent = `${shoe.category} | ${shoe.colorways.length} ${copy.cardColors}`;

    const title = document.createElement('h3');
    title.className = 'shoe-card-title';
    title.textContent = shoe.name;

    const desc = document.createElement('p');
    desc.className = 'shoe-card-desc';
    desc.textContent = localized.summary;

    const price = document.createElement('p');
    price.className = 'shoe-card-price';
    price.textContent = formatIdr(shoe.priceIdr);

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = isActive ? 'btn-secondary card-select-btn is-loaded' : 'btn-primary card-select-btn';
    selectBtn.textContent = isActive ? copy.cardLoaded : copy.cardLoadBtn;
    selectBtn.addEventListener('click', () => {
      selectShoe(shoe, true);
      document.getElementById('showroom').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    body.append(cat, title, desc, price, selectBtn);
    card.append(stage, body);
    els.shoeSelectorList.appendChild(card);
  });
}

function selectShoe(shoe, applyDefaultPreset = true) {
  state.selectedShoe = shoe;
  if (applyDefaultPreset) {
    const cw = shoe.colorways[0];
    state.colors = {
      upper: cw.upper,
      overlay: cw.overlay,
      midsole: cw.midsole,
      outsole: cw.outsole,
      accent: cw.accent,
      laces: cw.laces
    };
    state.activeColorwayName = cw.name;
    state.material = shoe.architecture.upperDefaultMaterial;
  }
  renderShoeSelectorList();
  renderShoeDetails();
  if (studio) {
    studio.loadShoe(shoe, state.colors, state.material);
  }
}

async function fetchCatalog(category = 'all') {
  state.activeCategory = category;
  els.catalogLoading.hidden = false;
  els.catalogError.hidden = true;
  els.catalogEmpty.hidden = true;
  els.catalogWorkbench.hidden = true;

  try {
    const url = category === 'all'
      ? '/api/shoes'
      : `/api/shoes?category=${encodeURIComponent(category)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    if (category === 'all') {
      state.shoes = list;
    }
    state.filteredShoes = list;
    els.catalogLoading.hidden = true;

    if (list.length === 0) {
      els.catalogEmpty.hidden = false;
      return;
    }

    els.catalogWorkbench.hidden = false;
    const currentStillInList = state.selectedShoe
      ? list.find((s) => s.id === state.selectedShoe.id)
      : null;

    if (!currentStillInList) {
      selectShoe(list[0], true);
    } else {
      state.selectedShoe = currentStillInList;
      renderShoeSelectorList();
      renderShoeDetails();
    }
  } catch (err) {
    els.catalogLoading.hidden = true;
    els.catalogErrorMsg.textContent = `Error loading catalog (${err.message}).`;
    els.catalogError.hidden = false;
  }
}

async function fetchDesigns() {
  els.designsLoading.hidden = false;
  els.designsError.hidden = true;
  els.designsEmpty.hidden = true;
  els.designsList.hidden = true;

  try {
    const res = await fetch('/api/designs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const designs = await res.json();
    state.designs = designs;
    els.designsLoading.hidden = true;

    if (designs.length === 0) {
      els.designsEmpty.hidden = false;
      return;
    }

    renderDesignsList();
    els.designsList.hidden = false;
  } catch (err) {
    els.designsLoading.hidden = true;
    els.designsErrorMsg.textContent = `Error loading builds (${err.message}).`;
    els.designsError.hidden = false;
  }
}

function renderDesignsList() {
  const copy = t();
  els.designsList.replaceChildren();
  state.designs.forEach((design) => {
    const li = document.createElement('li');
    li.className = 'design-item';

    const meta = document.createElement('div');
    meta.className = 'design-meta';

    const title = document.createElement('span');
    title.className = 'design-title';
    title.textContent = design.name;

    const sub = document.createElement('span');
    sub.className = 'design-sub';
    sub.textContent = `${design.shoeName} (${design.material})`;

    const dots = document.createElement('div');
    dots.className = 'design-dots';
    ['upper', 'overlay', 'midsole', 'outsole', 'accent'].forEach((zone) => {
      const dot = document.createElement('span');
      dot.className = 'design-dot';
      dot.style.backgroundColor = design.colors[zone];
      dots.appendChild(dot);
    });

    meta.append(title, sub, dots);

    const actions = document.createElement('div');
    actions.className = 'design-actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn-secondary-sm';
    loadBtn.textContent = copy.useBuildBtn;
    loadBtn.addEventListener('click', () => {
      const targetShoe = state.shoes.find((s) => s.id === design.shoeId) || state.selectedShoe;
      state.colors = { ...design.colors };
      state.material = design.material;
      state.activeColorwayName = design.name;
      if (targetShoe && (!state.selectedShoe || targetShoe.id !== state.selectedShoe.id)) {
        selectShoe(targetShoe, false);
      } else {
        renderShoeDetails();
        if (studio) {
          studio.updateColors(state.colors);
          studio.updateMaterial(state.material);
        }
      }
      setFeedback(els.saveDesignFeedback, copy.appliedMsg(design.name), 'success');
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-ghost-sm';
    delBtn.textContent = copy.deleteBuildBtn;
    delBtn.setAttribute('aria-label', `${copy.deleteBuildBtn} ${design.name}`);
    delBtn.addEventListener('click', async () => {
      delBtn.disabled = true;
      try {
        const res = await fetch(`/api/designs/${encodeURIComponent(design.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await fetchDesigns();
      } catch {
        delBtn.disabled = false;
        setFeedback(els.saveDesignFeedback, 'Failed to delete build.', 'error');
      }
    });

    actions.append(loadBtn, delBtn);
    li.append(meta, actions);
    els.designsList.appendChild(li);
  });
}

function updateBagUI() {
  const copy = t();
  const totalQty = state.bag.reduce((sum, item) => sum + item.quantity, 0);
  els.bagCount.textContent = String(totalQty);

  const hasItems = state.bag.length > 0;
  els.bagEmptyState.hidden = hasItems;
  els.bagItemsList.hidden = !hasItems;
  els.checkoutForm.hidden = !hasItems;
  if (hasItems) {
    els.orderReceipt.hidden = true;
  }

  els.bagItemsList.replaceChildren();
  let totalIdr = 0;

  state.bag.forEach((item, index) => {
    totalIdr += item.priceIdr * item.quantity;
    const li = document.createElement('li');
    li.className = 'bag-item';

    const info = document.createElement('div');
    info.className = 'bag-item-info';

    const title = document.createElement('strong');
    title.textContent = `${item.shoeName} (EU ${item.sizeEu})`;

    const detail = document.createElement('span');
    detail.textContent = `${item.colorwayName} | ${item.material} | ${item.quantity}x ${formatIdr(item.priceIdr)}`;

    info.append(title, detail);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-ghost-sm';
    removeBtn.textContent = copy.deleteBuildBtn;
    removeBtn.addEventListener('click', () => {
      state.bag.splice(index, 1);
      updateBagUI();
    });

    li.append(info, removeBtn);
    els.bagItemsList.appendChild(li);
  });

  els.bagTotalPrice.textContent = formatIdr(totalIdr);
}

function stepSelectedShoe(direction) {
  if (state.shoes.length === 0) return;
  const currentIdx = state.shoes.findIndex((s) => s.id === state.selectedShoe?.id);
  const baseIdx = currentIdx >= 0 ? currentIdx : 0;
  const nextIdx = (baseIdx + direction + state.shoes.length) % state.shoes.length;
  selectShoe(state.shoes[nextIdx], true);
}

function setupEventListeners() {
  els.langBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });

  els.themeToggle.addEventListener('click', () => {
    const nextIdx = (THEMES.indexOf(state.theme) + 1) % THEMES.length;
    applyTheme(THEMES[nextIdx]);
  });

  els.prevShoeBtn.addEventListener('click', () => stepSelectedShoe(-1));
  els.nextShoeBtn.addEventListener('click', () => stepSelectedShoe(1));

  els.mobileMenuBtn.addEventListener('click', () => {
    const expanded = els.mobileMenuBtn.getAttribute('aria-expanded') === 'true';
    els.mobileMenuBtn.setAttribute('aria-expanded', String(!expanded));
    els.mobileNavPanel.hidden = expanded;
  });

  els.mobileNavPanel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      els.mobileMenuBtn.setAttribute('aria-expanded', 'false');
      els.mobileNavPanel.hidden = true;
    });
  });

  els.toggleRotateBtn.addEventListener('click', () => {
    if (!studio) return;
    const copy = t();
    const next = !studio.autoRotate;
    studio.setAutoRotate(next);
    els.toggleRotateBtn.setAttribute('aria-pressed', String(next));
    els.toggleRotateBtn.textContent = next ? copy.pauseSpin : copy.autoSpin;
  });

  els.toggleExplodeBtn.addEventListener('click', () => {
    if (!studio) return;
    const copy = t();
    const next = !studio.exploded;
    studio.setExploded(next);
    els.toggleExplodeBtn.setAttribute('aria-pressed', String(next));
    els.toggleExplodeBtn.textContent = next ? copy.assembleLayers : copy.explodeLayers;
  });

  els.camBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.camBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (studio) studio.setCameraPreset(btn.dataset.cam);
    });
  });

  els.zoneTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      els.zoneTabs.forEach((tEl) => {
        tEl.classList.remove('is-active');
        tEl.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      state.activeZone = tab.dataset.zone;
      renderPaletteSwatches();
    });
  });

  els.zoneColorInput.addEventListener('input', (e) => {
    state.colors[state.activeZone] = e.target.value.toUpperCase();
    state.activeColorwayName = t().customColorwayName;
    updateColorwayUI();
    if (studio) studio.updateColors(state.colors);
  });

  els.matBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.material = btn.dataset.material;
      syncMaterialButtons();
      if (studio) studio.updateMaterial(state.material);
    });
  });

  els.resetColorwayBtn.addEventListener('click', () => {
    if (!state.selectedShoe) return;
    selectShoe(state.selectedShoe, true);
    setFeedback(els.saveDesignFeedback, t().resetMsg, 'success');
  });

  els.saveDesignForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const copy = t();
    if (!state.selectedShoe) return;
    const cleanName = els.buildNameInput.value.trim();
    if (!cleanName) {
      setFeedback(els.saveDesignFeedback, copy.enterBuildNameErr, 'error');
      els.buildNameInput.focus();
      return;
    }

    setFeedback(els.saveDesignFeedback, copy.savingMsg);
    try {
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          shoeId: state.selectedShoe.id,
          material: state.material,
          colors: state.colors
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setFeedback(els.saveDesignFeedback, payload.error || 'Error saving build.', 'error');
        return;
      }
      els.buildNameInput.value = '';
      setFeedback(els.saveDesignFeedback, copy.savedMsg(payload.name), 'success');
      await fetchDesigns();
    } catch {
      setFeedback(els.saveDesignFeedback, 'Connection lost while saving.', 'error');
    }
  });

  els.refreshDesignsBtn.addEventListener('click', fetchDesigns);
  els.retryDesignsBtn.addEventListener('click', fetchDesigns);
  els.retryCatalogBtn.addEventListener('click', () => fetchCatalog(state.activeCategory));

  els.filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.filterBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      fetchCatalog(btn.dataset.category);
    });
  });

  els.addToBagBtn.addEventListener('click', () => {
    const copy = t();
    if (!state.selectedShoe || !state.selectedSize) return;
    const existing = state.bag.find(
      (item) =>
        item.shoeId === state.selectedShoe.id &&
        item.sizeEu === state.selectedSize &&
        item.colorwayName === state.activeColorwayName &&
        item.material === state.material
    );
    const sizeStock = state.selectedShoe.sizes.find((s) => s.eu === state.selectedSize)?.stock || 0;
    const nextQty = existing ? existing.quantity + 1 : 1;
    if (nextQty > sizeStock || nextQty > 5) {
      setFeedback(els.bagFeedback, copy.stockLimitErr, 'error');
      return;
    }

    if (existing) {
      existing.quantity += 1;
    } else {
      state.bag.push({
        shoeId: state.selectedShoe.id,
        shoeName: state.selectedShoe.name,
        priceIdr: state.selectedShoe.priceIdr,
        sizeEu: state.selectedSize,
        quantity: 1,
        colorwayName: state.activeColorwayName,
        material: state.material,
        colors: { ...state.colors }
      });
    }
    updateBagUI();
    if (!prefersReducedMotion) {
      els.bagCount.classList.remove('is-popping');
      void els.bagCount.offsetWidth;
      els.bagCount.classList.add('is-popping');
    }
    setFeedback(
      els.bagFeedback,
      copy.addedToBag(state.selectedShoe.name, state.selectedSize),
      'success'
    );
  });

  els.inspectLayerBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const copy = t();
      if (studio) {
        studio.focusLayer(layer);
        els.toggleExplodeBtn.setAttribute('aria-pressed', String(studio.exploded));
        els.toggleExplodeBtn.textContent = studio.exploded ? copy.assembleLayers : copy.explodeLayers;
      }
      document.getElementById('showroom').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  });

  els.openBagBtn.addEventListener('click', () => {
    els.orderReceipt.hidden = true;
    updateBagUI();
    els.bagDialog.showModal();
    els.closeBagBtn.focus();
  });

  els.closeBagBtn.addEventListener('click', () => els.bagDialog.close());
  els.bagGoCatalog.addEventListener('click', () => els.bagDialog.close());
  els.receiptDoneBtn.addEventListener('click', () => els.bagDialog.close());

  els.bagDialog.addEventListener('click', (e) => {
    if (e.target === els.bagDialog) {
      els.bagDialog.close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.mobileNavPanel.hidden) {
      els.mobileNavPanel.hidden = true;
      els.mobileMenuBtn.setAttribute('aria-expanded', 'false');
      els.mobileMenuBtn.focus();
    }
  });

  els.checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const copy = t();
    if (state.bag.length === 0) return;

    const name = els.customerName.value.trim();
    const email = els.customerEmail.value.trim();
    const address = els.shippingAddress.value.trim();

    if (name.length < 2) {
      setFeedback(els.checkoutFeedback, copy.errNameMin, 'error');
      els.customerName.focus();
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setFeedback(els.checkoutFeedback, copy.errEmailInvalid, 'error');
      els.customerEmail.focus();
      return;
    }
    if (address.length < 10) {
      setFeedback(els.checkoutFeedback, copy.errAddrMin, 'error');
      els.shippingAddress.focus();
      return;
    }

    els.submitOrderBtn.disabled = true;
    setFeedback(els.checkoutFeedback, copy.processingOrder);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          shippingAddress: address,
          items: state.bag
        })
      });
      const data = await res.json();
      els.submitOrderBtn.disabled = false;

      if (!res.ok) {
        setFeedback(els.checkoutFeedback, data.error || 'Order failed.', 'error');
        return;
      }

      state.bag = [];
      els.checkoutForm.reset();
      setFeedback(els.checkoutFeedback, '');
      updateBagUI();
      els.bagEmptyState.hidden = true;
      els.orderReceipt.hidden = false;
      els.receiptOrderId.textContent = data.orderId;
      els.receiptSummary.textContent = copy.receiptSummary(
        formatIdr(data.totalIdr),
        data.items.length,
        data.customerName
      );
      await fetchCatalog(state.activeCategory);
    } catch {
      els.submitOrderBtn.disabled = false;
      setFeedback(els.checkoutFeedback, 'Server connection failed.', 'error');
    }
  });
}

function setupScrollReveals() {
  const headings = [...document.querySelectorAll('.heading-wipe')];
  const cards = [
    document.querySelector('.customizer-layout'),
    ...document.querySelectorAll('.anatomy-row')
  ].filter(Boolean);

  document.querySelectorAll('.anatomy-row').forEach((row, index) => {
    row.style.setProperty('--reveal-delay', `${index * 65}ms`);
  });

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    headings.forEach((h) => h.classList.add('is-revealed'));
    cards.forEach((c) => c.classList.add('is-revealed'));
    return;
  }

  cards.forEach((el) => el.classList.add('reveal-target'));

  const revealItems = [
    ...headings.map((h) => ({ observeEl: h.parentElement || h, targetEl: h })),
    ...cards.map((c) => ({ observeEl: c, targetEl: c }))
  ];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealItems.forEach((item) => {
            if (item.observeEl === entry.target) {
              item.targetEl.classList.add('is-revealed');
            }
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05 }
  );

  const uniqueObserveTargets = new Set(revealItems.map((item) => item.observeEl));
  uniqueObserveTargets.forEach((el) => observer.observe(el));
}

async function bootstrap() {
  initLanguage();
  initTheme();
  studio = new StudioScene(els.canvasWrap, {
    onFallback(msg) {
      els.webglFallbackMsg.textContent = msg;
      els.webglFallback.hidden = false;
    }
  });
  studio.setTheme(state.theme);

  els.toggleRotateBtn.setAttribute('aria-pressed', String(studio.autoRotate));

  setupEventListeners();
  setupScrollReveals();
  applyLanguage(state.lang);
  await Promise.all([fetchCatalog('all'), fetchDesigns()]);
}

bootstrap();
