import { preparationEntry } from '../staff-entry.js';

const form = document.getElementById('staff-login-form');
const role = document.getElementById('staff-role');
const password = document.getElementById('staff-password');
const error = document.getElementById('staff-login-error');
const submit = document.getElementById('staff-login-submit');
const preparation = preparationEntry(new URLSearchParams(location.search));

if (preparation) role.value = 'chef';

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  error.textContent = '';
  password.removeAttribute('aria-invalid');
  submit.disabled = true;
  submit.textContent = 'Entrando…';
  try {
    const response = await fetch('../api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role.value, password: password.value })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) password.setAttribute('aria-invalid', 'true');
      throw new Error(result.error || 'No se pudo iniciar sesión. Intenta de nuevo.');
    }
    password.value = '';
    location.replace('../#' + (preparation || 'modulos'));
  } catch (failure) {
    error.textContent = failure instanceof TypeError
      ? 'No se pudo conectar. Revisa tu conexión y vuelve a intentar.'
      : failure.message;
    submit.disabled = false;
    submit.textContent = 'Iniciar sesión';
    if (password.hasAttribute('aria-invalid')) {
      password.focus();
      password.select();
    }
  }
});

password.addEventListener('input', () => {
  password.removeAttribute('aria-invalid');
  error.textContent = '';
});
