// Общие помощники интерфейса

export function toast(message, type = 'info', ms = 4200) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'err' : type === 'success' ? 'ok' : ''}`;
  const icon = document.createElement('span');
  icon.textContent = type === 'error' ? '⚠️' : type === 'success' ? '✅' : '💬';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(icon, text);
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

export function setLoading(btn, loading, text) {
  if (loading) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    if (text) btn.append(' ' + text);
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || text || 'OK';
  }
}

// Перевод ошибок Supabase на русский
export function ruError(err) {
  const m = (err && (err.message || err.error_description || String(err))) || '';
  const code = err && err.code;
  if (['PGRST202', 'PGRST205', 'PGRST204', '42P01', '42883', '42703'].includes(code) ||
      /schema cache|does not exist|could not find the (function|table)/i.test(m)) {
    return 'База данных не обновлена: выполни файл stage2.sql в Supabase (инструкция — на странице setup.html)';
  }
  if (code === '42501' || /permission denied/i.test(m)) {
    return 'Нет доступа к базе. Выполни stage2.sql в Supabase ещё раз (страница setup.html)';
  }
  const map = [
    [/invalid login credentials/i, 'Неверная почта или пароль'],
    [/row-level security/i, 'Нет прав на это действие'],
    [/jwt expired|invalid jwt|not authenticated/i, 'Сессия устарела. Выйди и войди заново'],
    [/email not confirmed/i, 'Почта ещё не подтверждена'],
    [/user already registered/i, 'Аккаунт с такой почтой уже существует'],
    [/token has expired or is invalid|otp.*(expired|invalid)/i, 'Код неверный или устарел'],
    [/for security purposes.*after (\d+) seconds/i, (x) => `Подожди ${x[1]} сек. перед повторной отправкой`],
    [/rate limit/i, 'Слишком много попыток. Подожди немного и попробуй снова'],
    [/password should be at least (\d+)/i, (x) => `Пароль должен быть не короче ${x[1]} символов`],
    [/unable to validate email|invalid format|email address .* is invalid/i, 'Некорректный адрес почты'],
    [/database error saving new user/i, 'Не удалось создать профиль. Возможно, этот ник уже занят'],
    [/duplicate key.*username|profiles_username_key/i, 'Этот ник уже занят'],
    [/failed to fetch|networkerror/i, 'Нет связи с сервером. Проверь интернет'],
    [/error sending confirmation email|error sending.*email/i, 'Не получилось отправить письмо. Проверь настройки почты (SMTP) в Supabase'],
  ];
  for (const [re, ru] of map) {
    const x = m.match(re);
    if (x) return typeof ru === 'function' ? ru(x) : ru;
  }
  return m || 'Что-то пошло не так';
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

// Кнопки «показать пароль»
export function initPasswordToggles() {
  document.querySelectorAll('.toggle-pass').forEach((b) => {
    b.addEventListener('click', () => {
      const input = b.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Скрыть' : 'Показать';
    });
  });
}

// Аватар по умолчанию — буква ника на голубом градиенте
export function defaultAvatar(name = '?') {
  const letter = (name.trim()[0] || '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#1d6bff"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#g)"/>
    <text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif"
      font-size="46" font-weight="700" fill="#021220">${letter.replace(/[<>&"']/g, '')}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
