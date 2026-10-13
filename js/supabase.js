import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.includes('ВСТАВЬ');

export const sb = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

// Показывает предупреждение, если ключи ещё не вставлены
export function showConfigBannerIfNeeded() {
  if (isConfigured) return false;
  const div = document.createElement('div');
  div.className = 'config-banner';
  div.innerHTML =
    '⚠️ Сайт ещё не подключён к базе данных. Открой файл <b>js/config.js</b> и вставь ' +
    'Project URL и anon key из Supabase (инструкция в README.md).';
  document.body.prepend(div);
  return true;
}

export async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}
