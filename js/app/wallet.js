import { sb, state, h, icon, avatar, coins, rpc, toast, modal, pickUser, timeAgo, emptyState } from './core.js';

export async function refreshBalance() {
  const { data } = await sb.from('wallets').select('balance,last_daily').eq('user_id', state.me.id).maybeSingle();
  if (data) {
    state.balance = data.balance;
    state.lastDaily = data.last_daily;
    window.dispatchEvent(new CustomEvent('sierra:balance', { detail: data.balance }));
  }
  return data;
}

export async function renderWallet(view) {
  const w = await refreshBalance();
  const balance = h('div', { class: 'balance-num' }, coins(w?.balance));
  const dailyBtn = h('button', { class: 'btn' }, '🎁 Забрать ежедневный бонус +25');
  const nextAt = w?.last_daily ? new Date(new Date(w.last_daily).getTime() + 20 * 3600e3) : null;
  if (nextAt && nextAt > new Date()) {
    dailyBtn.disabled = true;
    dailyBtn.textContent = '⏳ Следующий бонус ' + nextAt.toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  dailyBtn.onclick = async () => {
    dailyBtn.disabled = true;
    try {
      const b = await rpc('claim_daily');
      balance.textContent = coins(b);
      balance.classList.add('bump');
      toast('+25 SierCoin! Возвращайся завтра 😉', 'success');
      dailyBtn.textContent = '✅ Бонус получен';
      refreshBalance();
      loadHistory();
    } catch { dailyBtn.disabled = false; }
  };

  const sendBtn = h('button', { class: 'btn ghost' }, icon('send'), ' Перевести другу');
  sendBtn.onclick = async () => { if (await openSendCoins()) { await refreshBalance(); balance.textContent = coins(state.balance); loadHistory(); } };

  const history = h('div', { class: 'panel' });
  async function loadHistory() {
    const { data } = await sb.from('coin_tx').select('*').order('id', { ascending: false }).limit(50);
    history.replaceChildren(h('h3', {}, 'История операций'),
      ...(data && data.length ? data.map((t) => h('div', { class: 'tx' },
        h('span', { class: 'tx-ico ' + (t.amount > 0 ? 'in' : 'out') }, t.amount > 0 ? '↓' : '↑'),
        h('div', { class: 'row-main' }, h('b', {}, t.reason), h('span', { class: 'muted small' }, timeAgo(t.created_at))),
        h('b', { class: t.amount > 0 ? 'plus' : 'minus' }, (t.amount > 0 ? '+' : '') + coins(t.amount))))
        : [emptyState('🪙', 'Операций пока нет', '')]));
  }

  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Кошелёк')),
    h('section', { class: 'wallet-card fade-up' },
      h('div', { class: 'muted' }, 'Твой баланс'),
      h('div', { class: 'balance-row' }, h('span', { class: 'coin-big' }, '🪙'), balance, h('span', { class: 'cur' }, 'SierCoin')),
      h('div', { class: 'wallet-actions' }, dailyBtn, sendBtn)),
    h('section', { class: 'panel how' },
      h('h3', {}, 'Как получить SierCoin'),
      h('ul', {},
        h('li', {}, '🎉 100 SierCoin в подарок при регистрации'),
        h('li', {}, '📅 +25 каждый день — ежедневный бонус'),
        h('li', {}, '💎 Продавай NFT-подарки в Магазине'),
        h('li', {}, '🤝 Получай переводы от друзей'),
        h('li', {}, '🔄 Обменивай ненужные подарки на 80% их цены'))),
    history);
  await loadHistory();
}

// Перевод SierCoin (можно вызвать из чата с готовым получателем)
export function openSendCoins(toUser = null) {
  return new Promise(async (resolve) => {
    let recipient = toUser;
    if (!recipient) recipient = await pickUser({ title: 'Кому перевести?' });
    if (!recipient) return resolve(false);
    let ok = false;
    const amount = h('input', { class: 'input', type: 'number', min: 1, placeholder: 'Сумма' });
    const note = h('input', { class: 'input', maxlength: 255, placeholder: 'Комментарий (необязательно)' });
    const btn = h('button', { class: 'btn' }, 'Перевести');
    const m = modal('Перевод SierCoin', h('div', {},
      h('div', { class: 'gift-to' }, h('span', { class: 'muted' }, 'Кому:'),
        h('span', { class: 'chip-user' }, avatar(recipient.avatar_url || recipient.peer_avatar, recipient.display_name, 24), recipient.display_name)),
      h('div', { class: 'field' }, amount), h('div', { class: 'field' }, note),
      h('p', { class: 'muted small' }, `Доступно: ${coins(state.balance)} SierCoin`),
      btn), { onClose: () => resolve(ok) });
    amount.focus();
    btn.onclick = async () => {
      const v = Math.floor(Number(amount.value));
      if (!v || v < 1) return toast('Введи сумму', 'error');
      btn.disabled = true;
      try {
        await rpc('send_coins', { p_to: recipient.id, p_amount: v, p_note: note.value.trim() });
        ok = true;
        toast(`Отправлено ${coins(v)} SierCoin`, 'success');
        refreshBalance();
        m.close();
      } catch { btn.disabled = false; }
    };
  });
}
