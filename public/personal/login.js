import { preparationEntry } from '../staff-entry.js';
import { phosphorIconSvg } from './phosphor-icons.js?v=20261127k';

const PROFILES = [
  { value: 'admin', title: 'Administración', user: 'Nicol', icon: 'identification-badge-duotone' },
  { value: 'chef', title: 'Cocina', user: '', icon: 'chef-hat-duotone' }
];

const form = document.getElementById('staff-login-form');
const roleSelect = document.getElementById('staff-role');
const rolePicker = document.querySelector('.staff-role-picker');
const roleTrigger = document.getElementById('staff-role-trigger');
const roleIconBadge = document.getElementById('staff-role-icon-badge');
const roleCurrentText = document.getElementById('staff-role-current-text');
const roleCaret = document.getElementById('staff-role-caret');
const roleListbox = document.getElementById('staff-role-listbox');

const password = document.getElementById('staff-password');
const passwordWrap = document.getElementById('staff-password-wrap');
const passwordLock = document.getElementById('staff-password-lock');
const togglePasswordBtn = document.getElementById('staff-toggle-password');

const errorBox = document.getElementById('staff-login-error');
const submit = document.getElementById('staff-login-submit');
const submitIcon = document.getElementById('staff-login-submit-icon');
const submitLabel = document.getElementById('staff-login-submit-label');
const returnIcon = document.getElementById('staff-return-icon');

const activeBanner = document.getElementById('staff-active-session');
const activeLabel = document.getElementById('staff-active-session-label');
const activeLink = document.getElementById('staff-active-session-link');
const preparation = preparationEntry(new URLSearchParams(location.search));
const targetHash = '#' + (preparation || 'modulos');

let listboxOpen = false;
let focusedOptionIdx = 0;
let submitting = false;

function findProfile(value) {
  return PROFILES.find(profile => profile.value === value) || PROFILES[0];
}

function renderProfileText(container, profile) {
  const titleEl = document.createElement('strong');
  titleEl.className = 'staff-role-title';
  titleEl.textContent = profile.title;
  const children = [titleEl];
  if (profile.user) {
    const userEl = document.createElement('span');
    userEl.className = 'staff-role-user';
    userEl.textContent = profile.user;
    children.push(userEl);
  }
  container.replaceChildren(...children);
}

function renderListboxOptions() {
  const current = findProfile(roleSelect.value);
  roleListbox.innerHTML = PROFILES.map((profile, idx) => {
    const selected = profile.value === current.value;
    return `
      <div
        id="staff-role-option-${profile.value}"
        class="staff-role-option"
        role="option"
        tabindex="-1"
        data-role-value="${profile.value}"
        data-option-idx="${idx}"
        aria-selected="${selected}"
      >
        <span class="staff-role-icon-badge" aria-hidden="true">${phosphorIconSvg(profile.icon, { size: 22 })}</span>
        <span class="staff-input-sep" aria-hidden="true"></span>
        <span class="staff-role-text">
          <strong class="staff-role-title">${profile.title}</strong>
          ${profile.user ? `<span class="staff-role-user">${profile.user}</span>` : ''}
        </span>
      </div>
    `;
  }).join('');
}

function setSelectedRole(value, { focusTrigger = false } = {}) {
  const profile = findProfile(value);
  roleSelect.value = profile.value;
  roleIconBadge.innerHTML = phosphorIconSvg(profile.icon, { size: 22 });
  renderProfileText(roleCurrentText, profile);
  renderListboxOptions();
  focusedOptionIdx = PROFILES.findIndex(entry => entry.value === profile.value);
  if (focusTrigger) roleTrigger.focus();
}

function openListbox() {
  if (listboxOpen || submitting) return;
  listboxOpen = true;
  renderListboxOptions();
  roleListbox.hidden = false;
  roleTrigger.setAttribute('aria-expanded', 'true');
  focusedOptionIdx = Math.max(0, PROFILES.findIndex(entry => entry.value === roleSelect.value));
  const targetOption = roleListbox.querySelector(`[data-option-idx="${focusedOptionIdx}"]`);
  if (targetOption) {
    roleListbox.setAttribute('aria-activedescendant', targetOption.id);
    targetOption.focus();
  }
}

function closeListbox({ restoreFocus = false } = {}) {
  if (!listboxOpen) return;
  listboxOpen = false;
  roleListbox.hidden = true;
  roleTrigger.setAttribute('aria-expanded', 'false');
  roleListbox.removeAttribute('aria-activedescendant');
  if (restoreFocus) roleTrigger.focus();
}

function moveFocusedOption(delta) {
  focusedOptionIdx = (focusedOptionIdx + delta + PROFILES.length) % PROFILES.length;
  const targetOption = roleListbox.querySelector(`[data-option-idx="${focusedOptionIdx}"]`);
  if (targetOption) {
    roleListbox.setAttribute('aria-activedescendant', targetOption.id);
    targetOption.focus();
  }
}

function renderPasswordToggle() {
  const visible = password.type === 'text';
  togglePasswordBtn.innerHTML = phosphorIconSvg(visible ? 'eye-slash' : 'eye', { size: 20 });
  togglePasswordBtn.setAttribute('aria-pressed', String(visible));
  togglePasswordBtn.setAttribute('aria-label', visible ? 'Ocultar clave' : 'Mostrar clave');
}

function setError(message) {
  if (!message) {
    errorBox.hidden = true;
    errorBox.replaceChildren();
    password.removeAttribute('aria-invalid');
    passwordWrap.removeAttribute('data-invalid');
    return;
  }
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  errorBox.innerHTML = phosphorIconSvg('warning-circle', { size: 20, className: 'staff-login-error-icon' });
  errorBox.append(textSpan);
  errorBox.hidden = false;
}

function setLoading(loading) {
  submitting = loading;
  submit.disabled = loading;
  submit.toggleAttribute('data-loading', loading);
  submit.setAttribute('aria-busy', String(loading));
  roleTrigger.disabled = loading;
  submitIcon.innerHTML = phosphorIconSvg(loading ? 'spinner-gap' : 'sign-in', {
    size: 20,
    className: loading ? 'staff-icon-spin' : ''
  });
  submitLabel.textContent = loading ? 'Entrando…' : 'Iniciar sesión';
}

// Mount static regular Phosphor icons once
roleCaret.innerHTML = phosphorIconSvg('caret-down', { size: 20 });
passwordLock.innerHTML = phosphorIconSvg('lock-simple', { size: 20 });
returnIcon.innerHTML = phosphorIconSvg('arrow-left', { size: 18 });
renderPasswordToggle();
setLoading(false);
setSelectedRole(preparation ? 'chef' : roleSelect.value);

roleSelect.addEventListener('change', () => setSelectedRole(roleSelect.value));

roleTrigger.addEventListener('click', () => {
  if (listboxOpen) closeListbox();
  else openListbox();
});

roleTrigger.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openListbox();
  }
});

roleListbox.addEventListener('click', event => {
  const option = event.target.closest('[data-role-value]');
  if (!option) return;
  setSelectedRole(option.dataset.roleValue);
  closeListbox({ restoreFocus: true });
});

roleListbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocusedOption(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocusedOption(-1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    focusedOptionIdx = 0;
    moveFocusedOption(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    focusedOptionIdx = PROFILES.length - 1;
    moveFocusedOption(0);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const chosen = PROFILES[focusedOptionIdx];
    if (chosen) setSelectedRole(chosen.value);
    closeListbox({ restoreFocus: true });
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeListbox({ restoreFocus: true });
  } else if (event.key === 'Tab') {
    closeListbox();
  }
});

document.addEventListener('click', event => {
  if (listboxOpen && rolePicker && !rolePicker.contains(event.target)) {
    closeListbox();
  }
});

togglePasswordBtn.addEventListener('click', () => {
  password.type = password.type === 'password' ? 'text' : 'password';
  renderPasswordToggle();
  password.focus({ preventScroll: true });
});

fetch('../api/kitchen', { cache: 'no-store' })
  .then(async response => {
    if (!response.ok) return;
    const data = await response.json().catch(() => null);
    if (!data?.role) return;
    const profile = findProfile(data.role);
    activeLabel.textContent = profile.user
      ? `Sesión activa: ${profile.title} (${profile.user})`
      : `Sesión activa: ${profile.title}`;
    activeLink.href = '../' + targetHash;
    activeBanner.hidden = false;
  })
  .catch(() => {});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || submit.disabled) return;
  closeListbox();
  setError('');

  if (!password.value) {
    password.setAttribute('aria-invalid', 'true');
    passwordWrap.setAttribute('data-invalid', 'true');
    setError('Ingresa tu clave de acceso.');
    password.focus();
    return;
  }

  setLoading(true);
  try {
    const response = await fetch('../api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleSelect.value, password: password.value })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 400) {
        password.setAttribute('aria-invalid', 'true');
        passwordWrap.setAttribute('data-invalid', 'true');
      }
      throw new Error(result.error || 'No se pudo iniciar sesión. Intenta de nuevo.');
    }
    password.value = '';
    location.replace('../' + targetHash);
  } catch (failure) {
    setError(
      failure instanceof TypeError
        ? 'No se pudo conectar. Revisa tu conexión y vuelve a intentar.'
        : failure.message
    );
    setLoading(false);
    if (password.hasAttribute('aria-invalid')) {
      password.focus();
      password.select();
    }
  }
});

password.addEventListener('input', () => {
  if (errorBox.hidden && !password.hasAttribute('aria-invalid')) return;
  setError('');
});
