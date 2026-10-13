import { sb, state, h, icon, avatar, rpc, toast, ruError, confirmBox, openSupport } from './core.js';
import { editProfile } from './profile.js';

export async function renderSettings(view) {
  const { data: info } = await sb.from('private_info').select('*').eq('user_id', state.me.id).maybeSingle();
  const pi = info || { email: state.me.email, phone: null, find_by_email: true, find_by_phone: true };

  // ----- телефон -----
  const phoneInput = h('input', { class: 'input', type: 'tel', placeholder: '+7 999 123-45-67', value: pi.phone || '' });
  const phoneSave = h('button', { class: 'btn small' }, pi.phone ? 'Изменить' : 'Привязать');
  const phoneRemove = h('button', { class: 'btn ghost small', hidden: !pi.phone }, 'Отвязать');
  phoneSave.onclick = async () => {
    if (!phoneInput.value.trim()) return toast('Введи номер', 'error');
    phoneSave.disabled = true;
    try {
      const ph = await rpc('set_phone', { p: phoneInput.value });
      phoneInput.value = ph;
      phoneRemove.hidden = false;
      phoneSave.textContent = 'Изменить';
      toast('Номер привязан: ' + ph, 'success');
    } catch {}
    phoneSave.disabled = false;
  };
  phoneRemove.onclick = async () => {
    if (!(await confirmBox('Отвязать номер телефона? Тебя нельзя будет найти по нему.', 'Отвязать'))) return;
    await rpc('set_phone', { p: '' });
    phoneInput.value = '';
    phoneRemove.hidden = true;
    phoneSave.textContent = 'Привязать';
    toast('Номер отвязан');
  };

  // ----- приватность -----
  const byEmail = h('input', { type: 'checkbox' }); byEmail.checked = pi.find_by_email;
  const byPhone = h('input', { type: 'checkbox' }); byPhone.checked = pi.find_by_phone;
  const savePrivacy = async () => {
    try {
      await rpc('set_privacy', { by_email: byEmail.checked, by_phone: byPhone.checked });
      toast('Настройки приватности сохранены', 'success');
    } catch {}
  };
  byEmail.onchange = savePrivacy;
  byPhone.onchange = savePrivacy;

  // ----- смена пароля -----
  const curPass = h('input', { class: 'input', type: 'password', placeholder: 'Текущий пароль', autocomplete: 'current-password' });
  const newPass = h('input', { class: 'input', type: 'password', placeholder: 'Новый пароль (минимум 8 символов)', autocomplete: 'new-password' });
  const newPass2 = h('input', { class: 'input', type: 'password', placeholder: 'Повтори новый пароль', autocomplete: 'new-password' });
  const passBtn = h('button', { class: 'btn small' }, 'Сменить пароль');
  passBtn.onclick = async () => {
    const cur = curPass.value, np = newPass.value;
    if (!cur) return toast('Введи текущий пароль', 'error');
    if (np.length < 8) return toast('Новый пароль — минимум 8 символов', 'error');
    if (np !== newPass2.value) return toast('Новые пароли не совпадают', 'error');
    if (np === cur) return toast('Новый пароль совпадает со старым', 'error');
    passBtn.disabled = true;
    try {
      const email = pi.email || state.me.email;
      const { error: e1 } = await sb.auth.signInWithPassword({ email, password: cur });
      if (e1) throw new Error(/invalid login credentials/i.test(e1.message) ? 'Текущий пароль неверный' : ruError(e1));
      const { error: e2 } = await sb.auth.updateUser({ password: np });
      if (e2) throw new Error(/same|different from the old/i.test(e2.message) ? 'Новый пароль совпадает со старым' : ruError(e2));
      curPass.value = newPass.value = newPass2.value = '';
      toast('Пароль изменён ✓', 'success');
    } catch (e) {
      toast(e.message || 'Не удалось сменить пароль', 'error');
    }
    passBtn.disabled = false;
  };

  const logout = h('button', { class: 'btn ghost danger-text' }, icon('logout'), ' Выйти из аккаунта');
  logout.onclick = async () => {
    if (!(await confirmBox('Выйти из аккаунта?', 'Выйти', true))) return;
    await sb.auth.signOut();
    location.replace('index.html');
  };

  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Настройки')),

    h('section', { class: 'panel settings-block fade-up' },
      h('div', { class: 'row-item' },
        avatar(state.profile.avatar_url, state.profile.display_name, 56),
        h('div', { class: 'row-main' }, h('b', {}, state.profile.display_name), h('span', { class: 'muted' }, '@' + state.profile.username)),
        h('button', { class: 'btn ghost small', onclick: () => editProfile() }, icon('edit'), ' Изменить'))),

    h('section', { class: 'panel settings-block fade-up d1' },
      h('h3', {}, '📱 Номер телефона'),
      h('p', { class: 'muted small' }, 'По номеру тебя смогут найти друзья. Сам номер никому не показывается.'),
      h('div', { class: 'inline-form' }, phoneInput, phoneSave, phoneRemove),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'ℹ️ Пока номер не подтверждается по SMS — SMS платные, подключим позже.')),

    h('section', { class: 'panel settings-block fade-up d2' },
      h('h3', {}, '✉️ Почта'),
      h('p', {}, h('b', {}, pi.email || state.me.email)),
      h('p', { class: 'muted small' }, 'Почта подтверждена при регистрации и никому не показывается.')),

    h('section', { class: 'panel settings-block fade-up d3' },
      h('h3', {}, '🔑 Пароль'),
      h('p', { class: 'muted small', style: { marginBottom: '10px' } }, 'Пароль хранится зашифрованным — его не видит никто, даже администрация.'),
      h('div', { class: 'stack', style: { marginTop: 0, maxWidth: '420px' } }, curPass, newPass, newPass2, h('div', {}, passBtn))),

    h('section', { class: 'panel settings-block fade-up d3' },
      h('h3', {}, '🔒 Приватность'),
      h('label', { class: 'switch-row' }, byEmail, h('span', {}, 'Меня можно найти по почте')),
      h('label', { class: 'switch-row' }, byPhone, h('span', {}, 'Меня можно найти по номеру телефона'))),

    h('section', { class: 'panel settings-block fade-up d4' },
      h('h3', {}, '💬 Поддержка'),
      h('p', { class: 'muted small', style: { marginBottom: '10px' } }, 'Вопрос, ошибка или жалоба? Напиши администрации — ответ придёт в чат.'),
      h('button', { class: 'btn small', onclick: openSupport }, 'Написать в поддержку')),

    state.isAdmin ? h('section', { class: 'panel settings-block' },
      h('h3', {}, '🛡️ Администратор'),
      h('a', { class: 'btn small', href: '#/admin' }, 'Открыть админ-панель')) : null,

    h('section', { class: 'panel settings-block fade-up d4' },
      h('h3', {}, 'Аккаунт'),
      logout));
}
