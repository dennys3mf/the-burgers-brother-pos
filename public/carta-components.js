// Reusable Carta UI components and responsive geometry helpers.

export const CARTA_CATEGORIES = [
  { index: 0, id: 'hamburguesas', label: 'Hamburguesas', icon: 'burger', listCategory: 'Hamburguesas' },
  { index: 1, id: 'alitas', label: 'Alitas y combos', icon: 'drumstick', listCategory: 'Alitas y Combos' },
  { index: 2, id: 'bebidas', label: 'Bebidas', icon: 'cup-soda', listCategory: 'Bebidas y Frappes' },
  { index: 3, id: 'salchipapas', label: 'Salchipapas y broster', icon: 'utensils', listCategory: 'Salchipapas y Broster' },
  { index: 4, id: 'cocteles', label: 'Cócteles', icon: 'martini', listCategory: 'Cocteles (Barra)' }
];

export const PAGE_ASPECT_RATIO = 559 / 790;
export const SPREAD_ASPECT_RATIO = 1118 / 790;
const MIN_SPREAD_LEAF_WIDTH = 355;

export function burgerIconSvg(size = 24) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 10.5C5 6.8 8.1 4.5 12 4.5s7 2.3 7 6H5z" />
      <path d="M4 13.5h16" />
      <path d="M4.8 16.2c1.2.8 2.3.8 3.6 0 1.2-.8 2.4-.8 3.6 0 1.2.8 2.4.8 3.6 0 1.3-.8 2.4-.8 3.6 0" />
      <path d="M5.5 18.8c0 1.1.9 1.7 2 1.7h9c1.1 0 2-.6 2-1.7H5.5z" />
    </svg>`;
}

function categoryIconMarkup(iconName) {
  if (iconName === 'burger') return burgerIconSvg(20);
  return `<i data-lucide="${iconName}" aria-hidden="true"></i>`;
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
        ? '<span class="carta-sheet-trail" aria-hidden="true"><i data-lucide="check" class="carta-cat-check"></i><i data-lucide="chevron-right" class="carta-cat-chevron"></i></span>'
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
