import { PHOSPHOR_ICONS, phosphorIconSvg } from './carta-icons.js?v=20261127-black-gold';

export const publicIcon = phosphorIconSvg;

export function syncPublicCartIcon(hasItems) {
  const icon = document.querySelector('#btn-mobile-cart [data-public-menu-icon]');
  if (!icon) return;
  const variant = hasItems ? 'shopping-bag-fill' : 'shopping-bag-duotone';
  if (icon.dataset.menuVariant === variant) return;
  icon.innerHTML = PHOSPHOR_ICONS[variant];
  icon.dataset.menuVariant = variant;
}
const namedIcons = {
  'book-open': 'book-open-duotone',
  search: 'magnifying-glass-duotone',
  'layout-grid': 'squares-four-duotone',
  'shopping-bag': 'shopping-bag-duotone',
  drumstick: 'bowl-food-duotone',
  'cup-soda': 'coffee-duotone',
  utensils: 'fork-knife-duotone',
  martini: 'wine-duotone',
  'chevron-left': 'caret-left',
  'chevron-right': 'caret-right',
  'trash-2': 'trash',
  'locate-fixed': 'crosshair',
  'external-link': 'arrow-square-out',
  'map-pin': 'map-pin',
  send: 'paper-plane-tilt',
  bike: 'bicycle',
  'calendar-x': 'calendar-x',
  'calendar-off': 'calendar-x',
  'clock': 'clock',
  'clipboard-list': 'receipt',
  'circle-check': 'check-circle',
  'check-circle-2': 'check-circle',
  'credit-card': 'credit-card',
  'alert-circle': 'warning-circle',
  'triangle-alert': 'warning-circle',
  plus: 'plus',
  check: 'check',
  x: 'x'
};

const scope = ':is(.menu-browser, #carta-mobile-nav, #carta-category-sheet, #client-cart, #modal-customize, #client-tracker-modal, #business-closed-modal)';
const initialIcons = new WeakMap();

export function syncPublicMenuIcons(isPublic) {
  const mark = document.getElementById('carta-brand-icon');
  if (isPublic && !Object.hasOwn(mark.dataset, 'publicMark')) {
    initialIcons.set(mark, mark.firstElementChild);
    mark.innerHTML = publicIcon('hamburger-duotone', { size: 26 });
    mark.dataset.publicMark = '';
  } else if (!isPublic && Object.hasOwn(mark.dataset, 'publicMark')) {
    mark.replaceChildren(initialIcons.get(mark));
    delete mark.dataset.publicMark;
  }

  if (!isPublic) {
    for (const svg of document.querySelectorAll(`${scope} [data-public-menu-icon]`)) {
      svg.replaceWith(initialIcons.get(svg));
    }
    return;
  }
  const categoryBurger = '[data-carta-category-page="0"] .carta-cat-icon > svg:not([data-public-menu-icon])';
  for (const icon of document.querySelectorAll(`${scope} [data-lucide], ${scope} ${categoryBurger}`)) {
    const key = icon.getAttribute('data-lucide');
    const name = key ? namedIcons[key] : 'hamburger-duotone';
    if (!name) continue;
    const size = icon.closest('#carta-mobile-nav, .carta-cat-icon') ? 24 : 20;
    const wrapping = document.createElement('template');
    const className = Array.from(icon.classList).filter(name => name !== 'lucide' && !name.startsWith('lucide-')).join(' ');
    wrapping.innerHTML = publicIcon(name, { size });
    const svg = wrapping.content.firstElementChild;
    if (!svg) continue;
    if (className) svg.setAttribute('class', className);
    svg.dataset.publicMenuIcon = '';
    initialIcons.set(svg, icon);
    icon.replaceWith(svg);
  }
}
