// Reusable Carta UI components and responsive geometry helpers.
// Icons: Phosphor Icons (inline SVG paths) — no Lucide dependency in public carta.

export const CARTA_CATEGORIES = [
  { index: 0, id: 'hamburguesas', label: 'Hamburguesas', icon: 'hamburger', listCategory: 'Hamburguesas' },
  { index: 1, id: 'alitas', label: 'Alitas y combos', icon: 'bowl-food', listCategory: 'Alitas y Combos' },
  { index: 2, id: 'bebidas', label: 'Bebidas', icon: 'coffee', listCategory: 'Bebidas y Frappes' },
  { index: 3, id: 'salchipapas', label: 'Salchipapas y broster', icon: 'fork-knife', listCategory: 'Salchipapas y Broster' },
  { index: 4, id: 'cocteles', label: 'Cócteles', icon: 'wine', listCategory: 'Cocteles (Barra)' }
];

export const PAGE_ASPECT_RATIO = 559 / 790;
export const SPREAD_ASPECT_RATIO = 1118 / 790;
const MIN_SPREAD_LEAF_WIDTH = 355;

/** Phosphor icon SVG paths keyed by name */
const PH_ICONS = {
  // Hamburger (custom burger shape)
  hamburger: `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,88H32A16,16,0,0,1,16,72V56A40,40,0,0,1,56,16H200a40,40,0,0,1,40,40V72A16,16,0,0,0,224,88ZM32,104a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16Zm-8,40v16a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V144Z" opacity="0.2"/><path d="M224,80H32V56a24,24,0,0,1,24-24H200a24,24,0,0,1,24,24ZM16,96v16a8,8,0,0,0,16,0V96Zm208,0v16a8,8,0,0,0,16,0V96ZM16,128v16a40,40,0,0,0,40,40H200a40,40,0,0,0,40-40V128Z"/></svg>`,
  // Bowl Food
  'bowl-food': `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,120H40A88,88,0,0,0,216,120Z" opacity="0.2"/><path d="M222.19,112H221A96,96,0,0,0,32,80H24a8,8,0,0,0,0,16h8c0,1.33.09,2.65.16,4H28a8,8,0,0,0,0,16H33.56A96.21,96.21,0,0,0,120,207.4V224H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16H136V207.4A96.21,96.21,0,0,0,222.44,116H228a8,8,0,0,0-5.81-7.81ZM128,200a80,80,0,0,1-79.6-72H207.6A80.09,80.09,0,0,1,128,200Z"/></svg>`,
  // Coffee
  coffee: `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M176,112h16a32,32,0,0,1,0,64H176Z" opacity="0.2"/><path d="M80,40a8,8,0,0,1,8-8c13.25,0,20.59,4.76,27.11,9,5.84,3.82,10.45,6.84,20.89,6.84s15.05-3,20.89-6.84C163.41,36.76,170.75,32,184,32a8,8,0,0,1,0,16c-10.44,0-15.05,3-20.89,6.84C156.59,59.24,149.25,64,136,64s-20.59-4.76-27.11-9C103.05,51,98.44,48,88,48A8,8,0,0,1,80,40ZM232,112H208V104a8,8,0,0,0-16,0v8H48a8,8,0,0,0-7.94,7.14C37.08,160.11,43.07,197.09,61.69,219.3A48,48,0,0,0,98.59,236H157.41a48,48,0,0,0,36.9-16.7C213,196.84,219,159,216.07,119.14H232a24,24,0,0,0,0-48Zm-48,88.37A32,32,0,0,1,157.41,220H98.59a32,32,0,0,1-24.59-11.37C60.44,192.13,55.3,164,56.37,128H199.5C200.6,164.11,195.42,192.26,184,200.37ZM232,144H208V128h24a8,8,0,0,1,0,16Z"/></svg>`,
  // Fork & knife (utensils replacement)
  'fork-knife': `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M72,32V224a8,8,0,0,1-16,0V152H32V80A48,48,0,0,1,72,32Zm120,0a8,8,0,0,0-8,8V96H168V40a8,8,0,0,0-16,0V224a8,8,0,0,0,16,0V112h16v112a8,8,0,0,0,16,0V40A8,8,0,0,0,192,32Z"/></svg>`,
  // Wine glass
  wine: `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M192,76c0,41-28.69,67.56-55.52,76.37A8.06,8.06,0,0,1,128,152a7.93,7.93,0,0,1-8.48-.63C92.69,142.56,64,116,64,76V40H192Z" opacity="0.2"/><path d="M200,40H56a8,8,0,0,0-8,8V76c0,47.35,32.49,75.59,60.42,86.22L104,224H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H152l-4.44-61.73C175.51,151.59,208,123.35,208,76V48A8,8,0,0,0,200,40Zm-8,36c0,37.63-28.19,61.86-56,70.25V56h56Z"/></svg>`,
  // Check mark
  check: `<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`,
  // Caret right
  'caret-right': `<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>`,
};

function categoryIconMarkup(iconName) {
  return PH_ICONS[iconName] || PH_ICONS['fork-knife'];
}

/**
 * Populates category navigation controls from CARTA_CATEGORIES so desktop
 * sidebar and mobile/tablet bottom sheet share one single source of truth.
 */
export function renderCategoryNav(container, { variant = 'sidebar' } = {}) {
  if (!container) return;
  const isSheet = variant === 'sheet';
  container.replaceChildren(...CARTA_CATEGORIES.map(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = isSheet ? 'carta-sheet-item' : 'carta-sidebar-item';
    button.dataset.cartaCategoryPage = String(category.index);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `
      <span class="carta-cat-main">
        <span class="carta-cat-icon" aria-hidden="true">${categoryIconMarkup(category.icon)}</span>
        <span class="carta-cat-label">${category.label}</span>
      </span>
      ${isSheet
        ? `<span class="carta-sheet-trail" aria-hidden="true"><span class="carta-cat-check">${PH_ICONS.check}</span><span class="carta-cat-chevron">${PH_ICONS['caret-right']}</span></span>`
        : ''}`;
    return button;
  }));
}

/**
 * Updates active highlights on both CategorySidebar and CategoryBottomSheet.
 */
export function syncCategoryNavState(activeIndex, spreadLeft = null, spreadRight = null) {
  document.querySelectorAll('[data-carta-category-page]').forEach(button => {
    const idx = Number(button.dataset.cartaCategoryPage);
    const isPrimary = idx === activeIndex;
    const isVisibleInSpread = spreadLeft !== null && (idx === spreadLeft || idx === spreadRight);
    button.setAttribute('aria-pressed', String(isPrimary));
    button.toggleAttribute('data-in-spread', !isPrimary && isVisibleInSpread);
    if (isPrimary) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

/**
 * Determines if 2-page open book layout preserves crisp typography without crowding.
 */
export function canFitBookSpread({ viewportWidth, viewportHeight, stageContainerWidth, maxBookHeight }) {
  const isLandscapeTablet = viewportWidth >= 768 && viewportWidth > viewportHeight;
  const isDesktop = viewportWidth >= 1024;
  if (!isDesktop && !isLandscapeTablet) return false;
  if (stageContainerWidth < MIN_SPREAD_LEAF_WIDTH * 2) return false;
  const constrainedHeight = Math.max(360, maxBookHeight || (viewportHeight - 160));
  const renderedSpreadWidth = Math.min(stageContainerWidth, constrainedHeight * SPREAD_ASPECT_RATIO);
  return renderedSpreadWidth / 2 >= MIN_SPREAD_LEAF_WIDTH;
}

/**
 * Builds one rendered PDF page leaf along with accessible proportional hotspot overlays.
 */
export function buildMenuPageLeaf({ page, index, totalPages, spread, side, menuById, formatMoney, onImageError }) {
  const leaf = document.createElement('article');
  leaf.className = `carta-page-leaf carta-page-leaf--${side}`;
  leaf.dataset.pageIndex = String(index);
  leaf.setAttribute('aria-label', `Página ${index + 1} de ${totalPages}: ${page.title}`);

  const heading = document.createElement('h3');
  heading.className = 'sr-only';
  heading.textContent = `Página ${index + 1}: ${page.title}`;

  const image = new Image(559, 790);
  image.alt = `Carta de The Burgers Brother, página ${index + 1} de ${totalPages}: ${page.title}`;
  image.draggable = false;
  image.loading = index === 0 ? 'eager' : 'lazy';
  image.decoding = 'async';
  const path = `./carta/carta-${index + 1}`;
  image.sizes = spread ? '(max-width: 1200px) 420px, 540px' : '(max-width: 767px) calc(100vw - 24px), 620px';
  image.srcset = `${path}-720.webp 720w, ${path}-1120.webp 1120w`;
  image.src = `${path}-720.webp`;
  if (onImageError) image.addEventListener('error', onImageError, { once: true });

  const hotspots = page.spots.map(({ id, left, right, top, bottom, showPrice }) => {
    const item = menuById.get(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carta-spot';
    button.dataset.openCust = id;
    button.dataset.pageIndex = String(index);
    if (showPrice) {
      button.classList.add('carta-spot-priced');
      const price = document.createElement('span');
      price.textContent = formatMoney(item.price);
      price.setAttribute('aria-hidden', 'true');
      button.append(price);
    }
    button.setAttribute('aria-label', `${item.name}, ${formatMoney(item.price)}. Personalizar y agregar`);
    button.style.left = `${left / 559 * 100}%`;
    button.style.top = `${top / 790 * 100}%`;
    button.style.width = `${(right - left) / 559 * 100}%`;
    button.style.height = `${(bottom - top) / 790 * 100}%`;
    return button;
  });

  const pageBadge = document.createElement('span');
  pageBadge.className = 'carta-leaf-number';
  pageBadge.setAttribute('aria-hidden', 'true');
  pageBadge.textContent = `${index + 1}`;

  leaf.append(heading, image, ...hotspots, pageBadge);
  return leaf;
}

/**
 * Enables smooth swipe-down dismissal on the category bottom sheet without
 * blocking vertical scrolling inside the list when overflowed.
 */
export function bindBottomSheetSwipe(sheetEl, listEl, onClose) {
  if (!sheetEl) return;
  let drag = null;

  sheetEl.addEventListener('pointerdown', event => {
    const onHandle = Boolean(event.target.closest('.carta-sheet-grabber, .carta-sheet-header'));
    const isTouchOrPen = event.pointerType === 'touch' || event.pointerType === 'pen';
    const isMouseDragOnHandle = event.pointerType === 'mouse' && event.button === 0 && onHandle;
    if (!isTouchOrPen && !isMouseDragOnHandle) return;
    if (!onHandle && listEl && listEl.scrollTop > 2 && listEl.contains(event.target)) return;
    drag = { id: event.pointerId, startY: event.clientY, deltaY: 0, startTime: Date.now(), moved: false };
    try { sheetEl.setPointerCapture?.(event.pointerId); } catch {}
  });

  sheetEl.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dy = event.clientY - drag.startY;
    if (dy <= 6) {
      drag.deltaY = 0;
      if (drag.moved) sheetEl.style.transform = '';
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      sheetEl.style.transition = 'none';
    }
    drag.deltaY = dy;
    sheetEl.style.transform = `translateY(${dy}px)`;
  });

  const finish = event => {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const { id, deltaY, startTime } = drag;
    drag = null;
    try { sheetEl.releasePointerCapture?.(id); } catch {}
    sheetEl.style.transition = '';
    sheetEl.style.transform = '';
    const velocity = deltaY / Math.max(1, Date.now() - startTime);
    if (deltaY > 72 || (deltaY > 28 && velocity > 0.45)) {
      onClose();
    }
  };

  sheetEl.addEventListener('pointerup', finish);
  sheetEl.addEventListener('pointercancel', finish);
}
