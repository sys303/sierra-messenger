-- =====================================================================
-- Sierra Messenger — ЭТАП 3
-- 250 подарков и NFT-атрибуты, реакции, пересылка, посты,
-- поддержка, жалобы, блокировки и админ-панель.
-- Запускать ПОСЛЕ stage2.sql. Можно запускать повторно.
-- =====================================================================

-- =====================================================================
-- 1. АДМИНИСТРАТОРЫ И БЛОКИРОВКИ
-- =====================================================================
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "Видеть себя в админах" on public.admins;
create policy "Видеть себя в админах" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public._require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Только для администратора'; end if;
end $$;

create table if not exists public.bans (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  reason     text not null default '',
  banned_by  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
drop policy if exists "Видеть свою блокировку" on public.bans;
create policy "Видеть свою блокировку" on public.bans for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.my_ban()
returns table (reason text, created_at timestamptz) language sql stable security definer set search_path = '' as $$
  select b.reason, b.created_at from public.bans b where b.user_id = auth.uid();
$$;

-- =====================================================================
-- 2. ПОДАРКИ: 250 штук и NFT-атрибуты
-- =====================================================================
alter table public.gift_catalog add column if not exists shape  int;
alter table public.gift_catalog add column if not exists colors text[];
alter table public.gift_catalog add column if not exists theme  text;
alter table public.gift_catalog add column if not exists tier   int not null default 0;
alter table public.gift_catalog add column if not exists effect text;

create table if not exists public.nft_models (
  name text primary key, colors text[], effect text,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
create table if not exists public.nft_backdrops (
  name text primary key, center text not null, edge text not null,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
create table if not exists public.nft_symbols (
  name text primary key, path text not null,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
alter table public.nft_models enable row level security;
alter table public.nft_backdrops enable row level security;
alter table public.nft_symbols enable row level security;
drop policy if exists "Модели видны всем" on public.nft_models;
create policy "Модели видны всем" on public.nft_models for select using (true);
drop policy if exists "Фоны видны всем" on public.nft_backdrops;
create policy "Фоны видны всем" on public.nft_backdrops for select using (true);
drop policy if exists "Символы видны всем" on public.nft_symbols;
create policy "Символы видны всем" on public.nft_symbols for select using (true);

alter table public.user_gifts add column if not exists value bigint;

-- Создано автоматически: python3 tools/gen_gifts.py — не редактируй вручную

insert into public.gift_catalog (id, name, emoji, price, total_supply, upgrade_price, sort, shape, colors, theme, tier, effect) values
  (1, 'Роза', '🌹', 15, null, 25, 1, 1, array['#e11d48','#fb7185','#fecdd3','#22c55e']::text[], 'Классика', 0, null),
  (2, 'Мишка', '🧸', 25, null, 25, 2, 2, array['#c08457','#8b5a33','#f5d5b0','#2a1a10']::text[], 'Классика', 0, null),
  (3, 'Сердце', '💙', 25, null, 25, 3, 3, array['#2f80ff','#6db8ff','#d6ecff','#0b3a8a']::text[], 'Классика', 0, null),
  (4, 'Торт', '🎂', 50, null, 25, 4, 4, array['#f9a8d4','#fde68a','#ffffff','#ef4444']::text[], 'Классика', 0, null),
  (5, 'Кубок', '🏆', 100, null, 25, 5, 5, array['#fbbf24','#b45309','#fef3c7','#78350f']::text[], 'Классика', 0, null),
  (6, 'Алмаз', '💎', 100, null, 25, 6, 6, array['#67e8f9','#0ea5e9','#e0f7ff','#0369a1']::text[], 'Классика', 0, null),
  (7, 'Ракета', '🚀', 250, null, 25, 7, 7, array['#e8edf3','#ef4444','#38bdf8','#94a3b8']::text[], 'Классика', 0, null),
  (8, 'Вершина Sierra', '🏔️', 500, 1000, 25, 8, 8, array['#3b82f6','#1e3a8a','#ffffff','#fbbf24']::text[], 'Классика', 1, null),
  (9, 'Корона', '👑', 1000, 300, 25, 9, 9, array['#fbbf24','#b45309','#ef4444','#3b82f6']::text[], 'Классика', 1, null),
  (10, 'Хрустальный шар', '🔮', 2500, 100, 25, 10, 10, array['#a78bfa','#4c1d95','#f0abfc','#5b3a1e']::text[], 'Классика', 1, null),
  (11, 'Звезда', '⭐', 35, null, 25, 11, 11, array['#fbbf24','#f59e0b','#fef3c7','#3b2a10']::text[], 'Классика', 0, null),
  (12, 'Луна', '🌙', 80, null, 25, 12, 12, array['#fde68a','#eab308','#ffffff','#a16207']::text[], 'Классика', 0, null),
  (13, 'Подарок', '🎁', 40, null, 25, 13, 13, array['#ef4444','#b91c1c','#fde047','#fca5a5']::text[], 'Классика', 0, null),
  (14, 'Шарик', '🎈', 20, null, 25, 14, 14, array['#f43f5e','#be123c','#ffe4e6','#cbd5e1']::text[], 'Классика', 0, null),
  (15, 'Мороженое', '🍦', 30, null, 25, 15, 15, array['#f9a8d4','#fde68a','#38bdf8','#ef4444']::text[], 'Классика', 0, null),
  (16, 'Леденец', '🍭', 20, null, 25, 16, 16, array['#ec4899','#be185d','#ffffff','#a855f7']::text[], 'Классика', 0, null),
  (17, 'Котик', '🐱', 60, null, 25, 17, 17, array['#f59e0b','#b45309','#fde68a','#1f2937']::text[], 'Классика', 0, null),
  (18, 'Призрак', '👻', 55, null, 25, 18, 18, array['#f1f5f9','#cbd5e1','#a5b4fc','#1e293b']::text[], 'Классика', 0, null),
  (19, 'Тыква', '🎃', 50, null, 25, 19, 19, array['#f97316','#c2410c','#fde047','#15803d']::text[], 'Классика', 0, null),
  (20, 'Снеговик', '⛄', 60, null, 25, 20, 20, array['#ef4444','#ffffff','#f8fafc','#1f2937']::text[], 'Классика', 0, null),
  (21, 'Ёлка', '🎄', 90, null, 25, 21, 21, array['#22c55e','#15803d','#facc15','#ef4444']::text[], 'Классика', 0, null),
  (22, 'Бабочка', '🦋', 75, null, 25, 22, 22, array['#38bdf8','#6366f1','#fde047','#1e1b4b']::text[], 'Классика', 0, null),
  (23, 'Грибок', '🍄', 45, null, 25, 23, 23, array['#ef4444','#b91c1c','#ffffff','#7c2d12']::text[], 'Классика', 0, null),
  (24, 'Планета', '🪐', 180, null, 25, 24, 24, array['#f59e0b','#b45309','#fde68a','#94a3b8']::text[], 'Классика', 0, null),
  (25, 'Зелье', '🧪', 140, null, 25, 25, 25, array['#a855f7','#7e22ce','#f0abfc','#7c4a1e']::text[], 'Классика', 0, null),
  (26, 'Роза «Рубин»', '🌹', 20, null, 25, 101, 1, array['#e11d48','#9f1239','#fecdd3','#22c55e']::text[], 'Рубин', 0, null),
  (27, 'Мишка «Рубин»', '🧸', 30, null, 25, 102, 2, array['#e11d48','#9f1239','#fecdd3','#2a1a10']::text[], 'Рубин', 0, null),
  (28, 'Сердце «Рубин»', '💙', 30, null, 25, 103, 3, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (29, 'Торт «Рубин»', '🎂', 60, null, 25, 104, 4, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (30, 'Кубок «Рубин»', '🏆', 120, null, 25, 105, 5, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (31, 'Алмаз «Рубин»', '💎', 120, null, 25, 106, 6, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (32, 'Ракета «Рубин»', '🚀', 300, null, 25, 107, 7, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (33, 'Вершина Sierra «Рубин»', '🏔️', 600, 800, 25, 108, 8, array['#e11d48','#9f1239','#ffffff','#fb7185']::text[], 'Рубин', 1, null),
  (34, 'Корона «Рубин»', '👑', 1200, 250, 25, 109, 9, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 1, null),
  (35, 'Хрустальный шар «Рубин»', '🔮', 3000, 80, 25, 110, 10, array['#e11d48','#9f1239','#fecdd3','#5b3a1e']::text[], 'Рубин', 1, null),
  (36, 'Звезда «Рубин»', '⭐', 40, null, 25, 111, 11, array['#e11d48','#9f1239','#fecdd3','#3b2a10']::text[], 'Рубин', 0, null),
  (37, 'Луна «Рубин»', '🌙', 95, null, 25, 112, 12, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (38, 'Подарок «Рубин»', '🎁', 50, null, 25, 113, 13, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (39, 'Шарик «Рубин»', '🎈', 25, null, 25, 114, 14, array['#e11d48','#9f1239','#fecdd3','#cbd5e1']::text[], 'Рубин', 0, null),
  (40, 'Мороженое «Рубин»', '🍦', 35, null, 25, 115, 15, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (41, 'Леденец «Рубин»', '🍭', 25, null, 25, 116, 16, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (42, 'Котик «Рубин»', '🐱', 70, null, 25, 117, 17, array['#e11d48','#9f1239','#fecdd3','#1f2937']::text[], 'Рубин', 0, null),
  (43, 'Призрак «Рубин»', '👻', 65, null, 25, 118, 18, array['#e11d48','#9f1239','#fecdd3','#1e293b']::text[], 'Рубин', 0, null),
  (44, 'Тыква «Рубин»', '🎃', 60, null, 25, 119, 19, array['#e11d48','#9f1239','#fecdd3','#15803d']::text[], 'Рубин', 0, null),
  (45, 'Снеговик «Рубин»', '⛄', 70, null, 25, 120, 20, array['#e11d48','#9f1239','#f8fafc','#1f2937']::text[], 'Рубин', 0, null),
  (46, 'Ёлка «Рубин»', '🎄', 110, null, 25, 121, 21, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (47, 'Бабочка «Рубин»', '🦋', 90, null, 25, 122, 22, array['#e11d48','#9f1239','#fecdd3','#1e1b4b']::text[], 'Рубин', 0, null),
  (48, 'Грибок «Рубин»', '🍄', 55, null, 25, 123, 23, array['#e11d48','#9f1239','#fecdd3','#7c2d12']::text[], 'Рубин', 0, null),
  (49, 'Планета «Рубин»', '🪐', 220, null, 25, 124, 24, array['#e11d48','#9f1239','#fecdd3','#fb7185']::text[], 'Рубин', 0, null),
  (50, 'Зелье «Рубин»', '🧪', 170, null, 25, 125, 25, array['#e11d48','#9f1239','#fecdd3','#7c4a1e']::text[], 'Рубин', 0, null),
  (51, 'Роза «Сапфир»', '🌹', 20, null, 25, 131, 1, array['#2563eb','#1e3a8a','#bfdbfe','#22c55e']::text[], 'Сапфир', 0, null),
  (52, 'Мишка «Сапфир»', '🧸', 30, null, 25, 132, 2, array['#2563eb','#1e3a8a','#bfdbfe','#2a1a10']::text[], 'Сапфир', 0, null),
  (53, 'Сердце «Сапфир»', '💙', 30, null, 25, 133, 3, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (54, 'Торт «Сапфир»', '🎂', 60, null, 25, 134, 4, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (55, 'Кубок «Сапфир»', '🏆', 120, null, 25, 135, 5, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (56, 'Алмаз «Сапфир»', '💎', 120, null, 25, 136, 6, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (57, 'Ракета «Сапфир»', '🚀', 300, null, 25, 137, 7, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (58, 'Вершина Sierra «Сапфир»', '🏔️', 600, 800, 25, 138, 8, array['#2563eb','#1e3a8a','#ffffff','#60a5fa']::text[], 'Сапфир', 1, null),
  (59, 'Корона «Сапфир»', '👑', 1200, 250, 25, 139, 9, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 1, null),
  (60, 'Хрустальный шар «Сапфир»', '🔮', 3000, 80, 25, 140, 10, array['#2563eb','#1e3a8a','#bfdbfe','#5b3a1e']::text[], 'Сапфир', 1, null),
  (61, 'Звезда «Сапфир»', '⭐', 40, null, 25, 141, 11, array['#2563eb','#1e3a8a','#bfdbfe','#3b2a10']::text[], 'Сапфир', 0, null),
  (62, 'Луна «Сапфир»', '🌙', 95, null, 25, 142, 12, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (63, 'Подарок «Сапфир»', '🎁', 50, null, 25, 143, 13, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (64, 'Шарик «Сапфир»', '🎈', 25, null, 25, 144, 14, array['#2563eb','#1e3a8a','#bfdbfe','#cbd5e1']::text[], 'Сапфир', 0, null),
  (65, 'Мороженое «Сапфир»', '🍦', 35, null, 25, 145, 15, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (66, 'Леденец «Сапфир»', '🍭', 25, null, 25, 146, 16, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (67, 'Котик «Сапфир»', '🐱', 70, null, 25, 147, 17, array['#2563eb','#1e3a8a','#bfdbfe','#1f2937']::text[], 'Сапфир', 0, null),
  (68, 'Призрак «Сапфир»', '👻', 65, null, 25, 148, 18, array['#2563eb','#1e3a8a','#bfdbfe','#1e293b']::text[], 'Сапфир', 0, null),
  (69, 'Тыква «Сапфир»', '🎃', 60, null, 25, 149, 19, array['#2563eb','#1e3a8a','#bfdbfe','#15803d']::text[], 'Сапфир', 0, null),
  (70, 'Снеговик «Сапфир»', '⛄', 70, null, 25, 150, 20, array['#2563eb','#1e3a8a','#f8fafc','#1f2937']::text[], 'Сапфир', 0, null),
  (71, 'Ёлка «Сапфир»', '🎄', 110, null, 25, 151, 21, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (72, 'Бабочка «Сапфир»', '🦋', 90, null, 25, 152, 22, array['#2563eb','#1e3a8a','#bfdbfe','#1e1b4b']::text[], 'Сапфир', 0, null),
  (73, 'Грибок «Сапфир»', '🍄', 55, null, 25, 153, 23, array['#2563eb','#1e3a8a','#bfdbfe','#7c2d12']::text[], 'Сапфир', 0, null),
  (74, 'Планета «Сапфир»', '🪐', 220, null, 25, 154, 24, array['#2563eb','#1e3a8a','#bfdbfe','#60a5fa']::text[], 'Сапфир', 0, null),
  (75, 'Зелье «Сапфир»', '🧪', 170, null, 25, 155, 25, array['#2563eb','#1e3a8a','#bfdbfe','#7c4a1e']::text[], 'Сапфир', 0, null),
  (76, 'Роза «Изумруд»', '🌹', 20, null, 25, 161, 1, array['#10b981','#065f46','#a7f3d0','#22c55e']::text[], 'Изумруд', 0, null),
  (77, 'Мишка «Изумруд»', '🧸', 30, null, 25, 162, 2, array['#10b981','#065f46','#a7f3d0','#2a1a10']::text[], 'Изумруд', 0, null),
  (78, 'Сердце «Изумруд»', '💙', 30, null, 25, 163, 3, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (79, 'Торт «Изумруд»', '🎂', 65, null, 25, 164, 4, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (80, 'Кубок «Изумруд»', '🏆', 130, null, 25, 165, 5, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (81, 'Алмаз «Изумруд»', '💎', 130, null, 25, 166, 6, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (82, 'Ракета «Изумруд»', '🚀', 320, null, 25, 167, 7, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (83, 'Вершина Sierra «Изумруд»', '🏔️', 650, 800, 25, 168, 8, array['#10b981','#065f46','#ffffff','#34d399']::text[], 'Изумруд', 1, null),
  (84, 'Корона «Изумруд»', '👑', 1300, 250, 25, 169, 9, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 1, null),
  (85, 'Хрустальный шар «Изумруд»', '🔮', 3250, 80, 25, 170, 10, array['#10b981','#065f46','#a7f3d0','#5b3a1e']::text[], 'Изумруд', 1, null),
  (86, 'Звезда «Изумруд»', '⭐', 45, null, 25, 171, 11, array['#10b981','#065f46','#a7f3d0','#3b2a10']::text[], 'Изумруд', 0, null),
  (87, 'Луна «Изумруд»', '🌙', 100, null, 25, 172, 12, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (88, 'Подарок «Изумруд»', '🎁', 50, null, 25, 173, 13, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (89, 'Шарик «Изумруд»', '🎈', 25, null, 25, 174, 14, array['#10b981','#065f46','#a7f3d0','#cbd5e1']::text[], 'Изумруд', 0, null),
  (90, 'Мороженое «Изумруд»', '🍦', 40, null, 25, 175, 15, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (91, 'Леденец «Изумруд»', '🍭', 25, null, 25, 176, 16, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (92, 'Котик «Изумруд»', '🐱', 80, null, 25, 177, 17, array['#10b981','#065f46','#a7f3d0','#1f2937']::text[], 'Изумруд', 0, null),
  (93, 'Призрак «Изумруд»', '👻', 70, null, 25, 178, 18, array['#10b981','#065f46','#a7f3d0','#1e293b']::text[], 'Изумруд', 0, null),
  (94, 'Тыква «Изумруд»', '🎃', 65, null, 25, 179, 19, array['#10b981','#065f46','#a7f3d0','#15803d']::text[], 'Изумруд', 0, null),
  (95, 'Снеговик «Изумруд»', '⛄', 80, null, 25, 180, 20, array['#10b981','#065f46','#f8fafc','#1f2937']::text[], 'Изумруд', 0, null),
  (96, 'Ёлка «Изумруд»', '🎄', 120, null, 25, 181, 21, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (97, 'Бабочка «Изумруд»', '🦋', 100, null, 25, 182, 22, array['#10b981','#065f46','#a7f3d0','#1e1b4b']::text[], 'Изумруд', 0, null),
  (98, 'Грибок «Изумруд»', '🍄', 60, null, 25, 183, 23, array['#10b981','#065f46','#a7f3d0','#7c2d12']::text[], 'Изумруд', 0, null),
  (99, 'Планета «Изумруд»', '🪐', 230, null, 25, 184, 24, array['#10b981','#065f46','#a7f3d0','#34d399']::text[], 'Изумруд', 0, null),
  (100, 'Зелье «Изумруд»', '🧪', 180, null, 25, 185, 25, array['#10b981','#065f46','#a7f3d0','#7c4a1e']::text[], 'Изумруд', 0, null),
  (101, 'Роза «Аметист»', '🌹', 20, null, 25, 191, 1, array['#a855f7','#581c87','#e9d5ff','#22c55e']::text[], 'Аметист', 0, null),
  (102, 'Мишка «Аметист»', '🧸', 35, null, 25, 192, 2, array['#a855f7','#581c87','#e9d5ff','#2a1a10']::text[], 'Аметист', 0, null),
  (103, 'Сердце «Аметист»', '💙', 35, null, 25, 193, 3, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (104, 'Торт «Аметист»', '🎂', 70, null, 25, 194, 4, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (105, 'Кубок «Аметист»', '🏆', 140, null, 25, 195, 5, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (106, 'Алмаз «Аметист»', '💎', 140, null, 25, 196, 6, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (107, 'Ракета «Аметист»', '🚀', 350, null, 25, 197, 7, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (108, 'Вершина Sierra «Аметист»', '🏔️', 700, 800, 25, 198, 8, array['#a855f7','#581c87','#ffffff','#c084fc']::text[], 'Аметист', 1, null),
  (109, 'Корона «Аметист»', '👑', 1400, 250, 25, 199, 9, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 1, null),
  (110, 'Хрустальный шар «Аметист»', '🔮', 3500, 80, 25, 200, 10, array['#a855f7','#581c87','#e9d5ff','#5b3a1e']::text[], 'Аметист', 1, null),
  (111, 'Звезда «Аметист»', '⭐', 50, null, 25, 201, 11, array['#a855f7','#581c87','#e9d5ff','#3b2a10']::text[], 'Аметист', 0, null),
  (112, 'Луна «Аметист»', '🌙', 110, null, 25, 202, 12, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (113, 'Подарок «Аметист»', '🎁', 55, null, 25, 203, 13, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (114, 'Шарик «Аметист»', '🎈', 30, null, 25, 204, 14, array['#a855f7','#581c87','#e9d5ff','#cbd5e1']::text[], 'Аметист', 0, null),
  (115, 'Мороженое «Аметист»', '🍦', 40, null, 25, 205, 15, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (116, 'Леденец «Аметист»', '🍭', 30, null, 25, 206, 16, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (117, 'Котик «Аметист»', '🐱', 85, null, 25, 207, 17, array['#a855f7','#581c87','#e9d5ff','#1f2937']::text[], 'Аметист', 0, null),
  (118, 'Призрак «Аметист»', '👻', 75, null, 25, 208, 18, array['#a855f7','#581c87','#e9d5ff','#1e293b']::text[], 'Аметист', 0, null),
  (119, 'Тыква «Аметист»', '🎃', 70, null, 25, 209, 19, array['#a855f7','#581c87','#e9d5ff','#15803d']::text[], 'Аметист', 0, null),
  (120, 'Снеговик «Аметист»', '⛄', 85, null, 25, 210, 20, array['#a855f7','#581c87','#f8fafc','#1f2937']::text[], 'Аметист', 0, null),
  (121, 'Ёлка «Аметист»', '🎄', 130, null, 25, 211, 21, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (122, 'Бабочка «Аметист»', '🦋', 100, null, 25, 212, 22, array['#a855f7','#581c87','#e9d5ff','#1e1b4b']::text[], 'Аметист', 0, null),
  (123, 'Грибок «Аметист»', '🍄', 65, null, 25, 213, 23, array['#a855f7','#581c87','#e9d5ff','#7c2d12']::text[], 'Аметист', 0, null),
  (124, 'Планета «Аметист»', '🪐', 250, null, 25, 214, 24, array['#a855f7','#581c87','#e9d5ff','#c084fc']::text[], 'Аметист', 0, null),
  (125, 'Зелье «Аметист»', '🧪', 200, null, 25, 215, 25, array['#a855f7','#581c87','#e9d5ff','#7c4a1e']::text[], 'Аметист', 0, null),
  (126, 'Роза «Закат»', '🌹', 25, null, 25, 221, 1, array['#fb923c','#c2410c','#fed7aa','#22c55e']::text[], 'Закат', 1, null),
  (127, 'Мишка «Закат»', '🧸', 40, null, 25, 222, 2, array['#fb923c','#c2410c','#fed7aa','#2a1a10']::text[], 'Закат', 1, null),
  (128, 'Сердце «Закат»', '💙', 40, null, 25, 223, 3, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (129, 'Торт «Закат»', '🎂', 80, null, 25, 224, 4, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (130, 'Кубок «Закат»', '🏆', 160, null, 25, 225, 5, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (131, 'Алмаз «Закат»', '💎', 160, null, 25, 226, 6, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (132, 'Ракета «Закат»', '🚀', 400, null, 25, 227, 7, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (133, 'Вершина Sierra «Закат»', '🏔️', 800, 800, 25, 228, 8, array['#fb923c','#c2410c','#ffffff','#f472b6']::text[], 'Закат', 1, null),
  (134, 'Корона «Закат»', '👑', 1600, 250, 25, 229, 9, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (135, 'Хрустальный шар «Закат»', '🔮', 4000, 80, 25, 230, 10, array['#fb923c','#c2410c','#fed7aa','#5b3a1e']::text[], 'Закат', 1, null),
  (136, 'Звезда «Закат»', '⭐', 55, null, 25, 231, 11, array['#fb923c','#c2410c','#fed7aa','#3b2a10']::text[], 'Закат', 1, null),
  (137, 'Луна «Закат»', '🌙', 130, null, 25, 232, 12, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (138, 'Подарок «Закат»', '🎁', 65, null, 25, 233, 13, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (139, 'Шарик «Закат»', '🎈', 30, null, 25, 234, 14, array['#fb923c','#c2410c','#fed7aa','#cbd5e1']::text[], 'Закат', 1, null),
  (140, 'Мороженое «Закат»', '🍦', 50, null, 25, 235, 15, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (141, 'Леденец «Закат»', '🍭', 30, null, 25, 236, 16, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (142, 'Котик «Закат»', '🐱', 95, null, 25, 237, 17, array['#fb923c','#c2410c','#fed7aa','#1f2937']::text[], 'Закат', 1, null),
  (143, 'Призрак «Закат»', '👻', 90, null, 25, 238, 18, array['#fb923c','#c2410c','#fed7aa','#1e293b']::text[], 'Закат', 1, null),
  (144, 'Тыква «Закат»', '🎃', 80, null, 25, 239, 19, array['#fb923c','#c2410c','#fed7aa','#15803d']::text[], 'Закат', 1, null),
  (145, 'Снеговик «Закат»', '⛄', 95, null, 25, 240, 20, array['#fb923c','#c2410c','#f8fafc','#1f2937']::text[], 'Закат', 1, null),
  (146, 'Ёлка «Закат»', '🎄', 140, null, 25, 241, 21, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (147, 'Бабочка «Закат»', '🦋', 120, null, 25, 242, 22, array['#fb923c','#c2410c','#fed7aa','#1e1b4b']::text[], 'Закат', 1, null),
  (148, 'Грибок «Закат»', '🍄', 70, null, 25, 243, 23, array['#fb923c','#c2410c','#fed7aa','#7c2d12']::text[], 'Закат', 1, null),
  (149, 'Планета «Закат»', '🪐', 290, null, 25, 244, 24, array['#fb923c','#c2410c','#fed7aa','#f472b6']::text[], 'Закат', 1, null),
  (150, 'Зелье «Закат»', '🧪', 220, null, 25, 245, 25, array['#fb923c','#c2410c','#fed7aa','#7c4a1e']::text[], 'Закат', 1, null),
  (151, 'Роза «Лёд»', '🌹', 25, null, 25, 251, 1, array['#bae6fd','#0ea5e9','#f0f9ff','#22c55e']::text[], 'Лёд', 1, 'frost'),
  (152, 'Мишка «Лёд»', '🧸', 45, null, 25, 252, 2, array['#bae6fd','#0ea5e9','#f0f9ff','#2a1a10']::text[], 'Лёд', 1, 'frost'),
  (153, 'Сердце «Лёд»', '💙', 45, null, 25, 253, 3, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (154, 'Торт «Лёд»', '🎂', 90, null, 25, 254, 4, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (155, 'Кубок «Лёд»', '🏆', 180, null, 25, 255, 5, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (156, 'Алмаз «Лёд»', '💎', 180, null, 25, 256, 6, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (157, 'Ракета «Лёд»', '🚀', 450, null, 25, 257, 7, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (158, 'Вершина Sierra «Лёд»', '🏔️', 900, 800, 25, 258, 8, array['#bae6fd','#0ea5e9','#ffffff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (159, 'Корона «Лёд»', '👑', 1800, 250, 25, 259, 9, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (160, 'Хрустальный шар «Лёд»', '🔮', 4500, 80, 25, 260, 10, array['#bae6fd','#0ea5e9','#f0f9ff','#5b3a1e']::text[], 'Лёд', 1, 'frost'),
  (161, 'Звезда «Лёд»', '⭐', 65, null, 25, 261, 11, array['#bae6fd','#0ea5e9','#f0f9ff','#3b2a10']::text[], 'Лёд', 1, 'frost'),
  (162, 'Луна «Лёд»', '🌙', 140, null, 25, 262, 12, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (163, 'Подарок «Лёд»', '🎁', 70, null, 25, 263, 13, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (164, 'Шарик «Лёд»', '🎈', 35, null, 25, 264, 14, array['#bae6fd','#0ea5e9','#f0f9ff','#cbd5e1']::text[], 'Лёд', 1, 'frost'),
  (165, 'Мороженое «Лёд»', '🍦', 55, null, 25, 265, 15, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (166, 'Леденец «Лёд»', '🍭', 35, null, 25, 266, 16, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (167, 'Котик «Лёд»', '🐱', 110, null, 25, 267, 17, array['#bae6fd','#0ea5e9','#f0f9ff','#1f2937']::text[], 'Лёд', 1, 'frost'),
  (168, 'Призрак «Лёд»', '👻', 100, null, 25, 268, 18, array['#bae6fd','#0ea5e9','#f0f9ff','#1e293b']::text[], 'Лёд', 1, 'frost'),
  (169, 'Тыква «Лёд»', '🎃', 90, null, 25, 269, 19, array['#bae6fd','#0ea5e9','#f0f9ff','#15803d']::text[], 'Лёд', 1, 'frost'),
  (170, 'Снеговик «Лёд»', '⛄', 110, null, 25, 270, 20, array['#bae6fd','#0ea5e9','#f8fafc','#1f2937']::text[], 'Лёд', 1, 'frost'),
  (171, 'Ёлка «Лёд»', '🎄', 160, null, 25, 271, 21, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (172, 'Бабочка «Лёд»', '🦋', 140, null, 25, 272, 22, array['#bae6fd','#0ea5e9','#f0f9ff','#1e1b4b']::text[], 'Лёд', 1, 'frost'),
  (173, 'Грибок «Лёд»', '🍄', 80, null, 25, 273, 23, array['#bae6fd','#0ea5e9','#f0f9ff','#7c2d12']::text[], 'Лёд', 1, 'frost'),
  (174, 'Планета «Лёд»', '🪐', 320, null, 25, 274, 24, array['#bae6fd','#0ea5e9','#f0f9ff','#7dd3fc']::text[], 'Лёд', 1, 'frost'),
  (175, 'Зелье «Лёд»', '🧪', 250, null, 25, 275, 25, array['#bae6fd','#0ea5e9','#f0f9ff','#7c4a1e']::text[], 'Лёд', 1, 'frost'),
  (176, 'Роза «Неон»', '🌹', 40, 2000, 25, 281, 1, array['#22d3ee','#c026d3','#a5f3fc','#22c55e']::text[], 'Неон', 2, 'glow'),
  (177, 'Мишка «Неон»', '🧸', 60, 2000, 25, 282, 2, array['#22d3ee','#c026d3','#a5f3fc','#2a1a10']::text[], 'Неон', 2, 'glow'),
  (178, 'Сердце «Неон»', '💙', 60, 2000, 25, 283, 3, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (179, 'Торт «Неон»', '🎂', 120, 2000, 25, 284, 4, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (180, 'Кубок «Неон»', '🏆', 250, 1000, 25, 285, 5, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (181, 'Алмаз «Неон»', '💎', 250, 1000, 25, 286, 6, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (182, 'Ракета «Неон»', '🚀', 620, 1000, 25, 287, 7, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (183, 'Вершина Sierra «Неон»', '🏔️', 1250, 200, 25, 288, 8, array['#22d3ee','#c026d3','#ffffff','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (184, 'Корона «Неон»', '👑', 2500, 200, 25, 289, 9, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (185, 'Хрустальный шар «Неон»', '🔮', 6200, 80, 25, 290, 10, array['#22d3ee','#c026d3','#a5f3fc','#5b3a1e']::text[], 'Неон', 2, 'glow'),
  (186, 'Звезда «Неон»', '⭐', 90, 2000, 25, 291, 11, array['#22d3ee','#c026d3','#a5f3fc','#3b2a10']::text[], 'Неон', 2, 'glow'),
  (187, 'Луна «Неон»', '🌙', 200, 2000, 25, 292, 12, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (188, 'Подарок «Неон»', '🎁', 100, 2000, 25, 293, 13, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (189, 'Шарик «Неон»', '🎈', 50, 2000, 25, 294, 14, array['#22d3ee','#c026d3','#a5f3fc','#cbd5e1']::text[], 'Неон', 2, 'glow'),
  (190, 'Мороженое «Неон»', '🍦', 75, 2000, 25, 295, 15, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (191, 'Леденец «Неон»', '🍭', 50, 2000, 25, 296, 16, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (192, 'Котик «Неон»', '🐱', 150, 2000, 25, 297, 17, array['#22d3ee','#c026d3','#a5f3fc','#1f2937']::text[], 'Неон', 2, 'glow'),
  (193, 'Призрак «Неон»', '👻', 140, 2000, 25, 298, 18, array['#22d3ee','#c026d3','#a5f3fc','#1e293b']::text[], 'Неон', 2, 'glow'),
  (194, 'Тыква «Неон»', '🎃', 120, 2000, 25, 299, 19, array['#22d3ee','#c026d3','#a5f3fc','#15803d']::text[], 'Неон', 2, 'glow'),
  (195, 'Снеговик «Неон»', '⛄', 150, 2000, 25, 300, 20, array['#22d3ee','#c026d3','#f8fafc','#1f2937']::text[], 'Неон', 2, 'glow'),
  (196, 'Ёлка «Неон»', '🎄', 220, 2000, 25, 301, 21, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (197, 'Бабочка «Неон»', '🦋', 190, 2000, 25, 302, 22, array['#22d3ee','#c026d3','#a5f3fc','#1e1b4b']::text[], 'Неон', 2, 'glow'),
  (198, 'Грибок «Неон»', '🍄', 110, 2000, 25, 303, 23, array['#22d3ee','#c026d3','#a5f3fc','#7c2d12']::text[], 'Неон', 2, 'glow'),
  (199, 'Планета «Неон»', '🪐', 450, 1000, 25, 304, 24, array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'Неон', 2, 'glow'),
  (200, 'Зелье «Неон»', '🧪', 350, 1000, 25, 305, 25, array['#22d3ee','#c026d3','#a5f3fc','#7c4a1e']::text[], 'Неон', 2, 'glow'),
  (201, 'Роза «Золото»', '🌹', 45, 1000, 25, 311, 1, array['#fcd34d','#a16207','#fff7cc','#22c55e']::text[], 'Золото', 2, 'shine'),
  (202, 'Мишка «Золото»', '🧸', 75, 1000, 25, 312, 2, array['#fcd34d','#a16207','#fff7cc','#2a1a10']::text[], 'Золото', 2, 'shine'),
  (203, 'Сердце «Золото»', '💙', 75, 1000, 25, 313, 3, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (204, 'Торт «Золото»', '🎂', 150, 1000, 25, 314, 4, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (205, 'Кубок «Золото»', '🏆', 300, 500, 25, 315, 5, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (206, 'Алмаз «Золото»', '💎', 300, 500, 25, 316, 6, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (207, 'Ракета «Золото»', '🚀', 750, 500, 25, 317, 7, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (208, 'Вершина Sierra «Золото»', '🏔️', 1500, 100, 25, 318, 8, array['#fcd34d','#a16207','#ffffff','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (209, 'Корона «Золото»', '👑', 3000, 100, 25, 319, 9, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (210, 'Хрустальный шар «Золото»', '🔮', 7500, 80, 25, 320, 10, array['#fcd34d','#a16207','#fff7cc','#5b3a1e']::text[], 'Золото', 2, 'shine'),
  (211, 'Звезда «Золото»', '⭐', 100, 1000, 25, 321, 11, array['#fcd34d','#a16207','#fff7cc','#3b2a10']::text[], 'Золото', 2, 'shine'),
  (212, 'Луна «Золото»', '🌙', 240, 1000, 25, 322, 12, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (213, 'Подарок «Золото»', '🎁', 120, 1000, 25, 323, 13, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (214, 'Шарик «Золото»', '🎈', 60, 1000, 25, 324, 14, array['#fcd34d','#a16207','#fff7cc','#cbd5e1']::text[], 'Золото', 2, 'shine'),
  (215, 'Мороженое «Золото»', '🍦', 90, 1000, 25, 325, 15, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (216, 'Леденец «Золото»', '🍭', 60, 1000, 25, 326, 16, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (217, 'Котик «Золото»', '🐱', 180, 1000, 25, 327, 17, array['#fcd34d','#a16207','#fff7cc','#1f2937']::text[], 'Золото', 2, 'shine'),
  (218, 'Призрак «Золото»', '👻', 160, 1000, 25, 328, 18, array['#fcd34d','#a16207','#fff7cc','#1e293b']::text[], 'Золото', 2, 'shine'),
  (219, 'Тыква «Золото»', '🎃', 150, 1000, 25, 329, 19, array['#fcd34d','#a16207','#fff7cc','#15803d']::text[], 'Золото', 2, 'shine'),
  (220, 'Снеговик «Золото»', '⛄', 180, 1000, 25, 330, 20, array['#fcd34d','#a16207','#f8fafc','#1f2937']::text[], 'Золото', 2, 'shine'),
  (221, 'Ёлка «Золото»', '🎄', 270, 1000, 25, 331, 21, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (222, 'Бабочка «Золото»', '🦋', 220, 1000, 25, 332, 22, array['#fcd34d','#a16207','#fff7cc','#1e1b4b']::text[], 'Золото', 2, 'shine'),
  (223, 'Грибок «Золото»', '🍄', 140, 1000, 25, 333, 23, array['#fcd34d','#a16207','#fff7cc','#7c2d12']::text[], 'Золото', 2, 'shine'),
  (224, 'Планета «Золото»', '🪐', 540, 500, 25, 334, 24, array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'Золото', 2, 'shine'),
  (225, 'Зелье «Золото»', '🧪', 420, 500, 25, 335, 25, array['#fcd34d','#a16207','#fff7cc','#7c4a1e']::text[], 'Золото', 2, 'shine'),
  (226, 'Роза «Космос»', '🌹', 60, 300, 25, 341, 1, array['#8b5cf6','#1e1b4b','#f0abfc','#22c55e']::text[], 'Космос', 3, 'stars'),
  (227, 'Мишка «Космос»', '🧸', 100, 300, 25, 342, 2, array['#8b5cf6','#1e1b4b','#f0abfc','#2a1a10']::text[], 'Космос', 3, 'stars'),
  (228, 'Сердце «Космос»', '💙', 100, 300, 25, 343, 3, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (229, 'Торт «Космос»', '🎂', 200, 300, 25, 344, 4, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (230, 'Кубок «Космос»', '🏆', 400, 150, 25, 345, 5, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (231, 'Алмаз «Космос»', '💎', 400, 150, 25, 346, 6, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (232, 'Ракета «Космос»', '🚀', 1000, 150, 25, 347, 7, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (233, 'Вершина Sierra «Космос»', '🏔️', 2000, 30, 25, 348, 8, array['#8b5cf6','#1e1b4b','#ffffff','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (234, 'Корона «Космос»', '👑', 4000, 30, 25, 349, 9, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (235, 'Хрустальный шар «Космос»', '🔮', 10000, 30, 25, 350, 10, array['#8b5cf6','#1e1b4b','#f0abfc','#5b3a1e']::text[], 'Космос', 3, 'stars'),
  (236, 'Звезда «Космос»', '⭐', 140, 300, 25, 351, 11, array['#8b5cf6','#1e1b4b','#f0abfc','#3b2a10']::text[], 'Космос', 3, 'stars'),
  (237, 'Луна «Космос»', '🌙', 320, 300, 25, 352, 12, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (238, 'Подарок «Космос»', '🎁', 160, 300, 25, 353, 13, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (239, 'Шарик «Космос»', '🎈', 80, 300, 25, 354, 14, array['#8b5cf6','#1e1b4b','#f0abfc','#cbd5e1']::text[], 'Космос', 3, 'stars'),
  (240, 'Мороженое «Космос»', '🍦', 120, 300, 25, 355, 15, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (241, 'Леденец «Космос»', '🍭', 80, 300, 25, 356, 16, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (242, 'Котик «Космос»', '🐱', 240, 300, 25, 357, 17, array['#8b5cf6','#1e1b4b','#f0abfc','#1f2937']::text[], 'Космос', 3, 'stars'),
  (243, 'Призрак «Космос»', '👻', 220, 300, 25, 358, 18, array['#8b5cf6','#1e1b4b','#f0abfc','#1e293b']::text[], 'Космос', 3, 'stars'),
  (244, 'Тыква «Космос»', '🎃', 200, 300, 25, 359, 19, array['#8b5cf6','#1e1b4b','#f0abfc','#15803d']::text[], 'Космос', 3, 'stars'),
  (245, 'Снеговик «Космос»', '⛄', 240, 300, 25, 360, 20, array['#8b5cf6','#1e1b4b','#f8fafc','#1f2937']::text[], 'Космос', 3, 'stars'),
  (246, 'Ёлка «Космос»', '🎄', 360, 300, 25, 361, 21, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (247, 'Бабочка «Космос»', '🦋', 300, 300, 25, 362, 22, array['#8b5cf6','#1e1b4b','#f0abfc','#1e1b4b']::text[], 'Космос', 3, 'stars'),
  (248, 'Грибок «Космос»', '🍄', 180, 300, 25, 363, 23, array['#8b5cf6','#1e1b4b','#f0abfc','#7c2d12']::text[], 'Космос', 3, 'stars'),
  (249, 'Планета «Космос»', '🪐', 720, 150, 25, 364, 24, array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'Космос', 3, 'stars'),
  (250, 'Зелье «Космос»', '🧪', 560, 150, 25, 365, 25, array['#8b5cf6','#1e1b4b','#f0abfc','#7c4a1e']::text[], 'Космос', 3, 'stars')
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price,
  total_supply = excluded.total_supply, upgrade_price = excluded.upgrade_price, sort = excluded.sort,
  shape = excluded.shape, colors = excluded.colors, theme = excluded.theme, tier = excluded.tier, effect = excluded.effect;

insert into public.nft_models (name, colors, effect, weight, mult, tier, sort) values
  ('Классика', null, null, 120, 1.0, 0, 0),
  ('Пастель', array['#fbcfe8','#f472b6','#ffffff','#c4b5fd']::text[], null, 120, 1.0, 0, 1),
  ('Мята', array['#6ee7b7','#059669','#ecfdf5','#a7f3d0']::text[], null, 120, 1.0, 0, 2),
  ('Карамель', array['#fdba74','#c2410c','#ffedd5','#fde68a']::text[], null, 120, 1.0, 0, 3),
  ('Лаванда', array['#c4b5fd','#6d28d9','#f5f3ff','#e9d5ff']::text[], null, 120, 1.0, 0, 4),
  ('Небо', array['#7dd3fc','#0369a1','#f0f9ff','#bae6fd']::text[], null, 120, 1.0, 0, 5),
  ('Лёд', array['#bae6fd','#38bdf8','#f0f9ff','#7dd3fc']::text[], 'frost', 70, 1.3, 1, 6),
  ('Аврора', array['#2dd4bf','#047857','#a7f3d0','#a3e635']::text[], null, 70, 1.3, 1, 7),
  ('Закат', array['#fb923c','#be185d','#fed7aa','#fde047']::text[], null, 70, 1.3, 1, 8),
  ('Океан', array['#0ea5e9','#1e3a8a','#e0f2fe','#22d3ee']::text[], null, 70, 1.3, 1, 9),
  ('Вишня', array['#f43f5e','#881337','#ffe4e6','#fda4af']::text[], null, 70, 1.3, 1, 10),
  ('Неон', array['#22d3ee','#c026d3','#a5f3fc','#f0abfc']::text[], 'glow', 35, 2.0, 2, 11),
  ('Пиксель', array['#f472b6','#facc15','#ffffff','#22d3ee']::text[], 'pixel', 35, 2.0, 2, 12),
  ('Рубин', array['#e11d48','#4c0519','#fecdd3','#fb7185']::text[], 'shine', 35, 2.0, 2, 13),
  ('Изумруд', array['#10b981','#022c22','#d1fae5','#34d399']::text[], 'shine', 35, 2.0, 2, 14),
  ('Токсик', array['#a3e635','#3f6212','#ecfccb','#facc15']::text[], 'glow', 35, 2.0, 2, 15),
  ('Хром', array['#e2e8f0','#475569','#ffffff','#94a3b8']::text[], 'shine', 14, 3.5, 3, 16),
  ('Обсидиан', array['#4b5563','#0b0f17','#c4b5fd','#9ca3af']::text[], 'glow', 14, 3.5, 3, 17),
  ('Лава', array['#f97316','#7f1d1d','#fde047','#ef4444']::text[], 'glow', 14, 3.5, 3, 18),
  ('Призрак', array['#e0e7ff','#818cf8','#ffffff','#c7d2fe']::text[], 'glow', 14, 3.5, 3, 19),
  ('Золото', array['#fcd34d','#a16207','#fff7cc','#f59e0b']::text[], 'shine', 5, 6.0, 4, 20),
  ('Космос', array['#8b5cf6','#1e1b4b','#f0abfc','#22d3ee']::text[], 'stars', 5, 6.0, 4, 21),
  ('Голограмма', array['#67e8f9','#a78bfa','#ffffff','#f0abfc']::text[], 'holo', 5, 6.0, 4, 22),
  ('Бриллиант', array['#e0f2fe','#7dd3fc','#ffffff','#bae6fd']::text[], 'stars', 5, 6.0, 4, 23)
on conflict (name) do update set colors = excluded.colors, effect = excluded.effect, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;

insert into public.nft_backdrops (name, center, edge, weight, mult, tier, sort) values
  ('Полночь', '#1d3b8f', '#0b1a3a', 120, 1.0, 0, 0),
  ('Графит', '#5b6677', '#1a1f27', 120, 1.0, 0, 1),
  ('Лазурь', '#4cc9ff', '#0e5aa7', 120, 1.0, 0, 2),
  ('Мята', '#3ee6a8', '#0f5c4d', 120, 1.0, 0, 3),
  ('Сирень', '#c4b5fd', '#4c3a8a', 120, 1.0, 0, 4),
  ('Песок', '#e7c99a', '#7a5a2e', 120, 1.0, 0, 5),
  ('Закат', '#ff8a4c', '#7a2a1a', 70, 1.3, 1, 6),
  ('Аметист', '#a46bff', '#3b1a6b', 70, 1.3, 1, 7),
  ('Океан', '#22d3ee', '#0c3d66', 70, 1.3, 1, 8),
  ('Вишня', '#fb7185', '#6b1230', 70, 1.3, 1, 9),
  ('Лайм', '#bef264', '#3f6212', 70, 1.3, 1, 10),
  ('Рубин', '#ff4d6d', '#5c0f22', 35, 2.0, 2, 11),
  ('Изумруд', '#10b981', '#064e3b', 35, 2.0, 2, 12),
  ('Индиго', '#818cf8', '#1e1b4b', 35, 2.0, 2, 13),
  ('Персик', '#fdba74', '#9a3412', 35, 2.0, 2, 14),
  ('Бирюза', '#5eead4', '#115e59', 35, 2.0, 2, 15),
  ('Северное сияние', '#4ade80', '#1e1b4b', 14, 3.5, 3, 16),
  ('Магма', '#fb923c', '#450a0a', 14, 3.5, 3, 17),
  ('Неоновая ночь', '#f0abfc', '#0f0a2e', 14, 3.5, 3, 18),
  ('Морская глубина', '#38bdf8', '#020617', 14, 3.5, 3, 19),
  ('Золотой рассвет', '#fde68a', '#b45309', 5, 6.0, 4, 20),
  ('Чёрная дыра', '#a78bfa', '#000000', 5, 6.0, 4, 21),
  ('Платина', '#f8fafc', '#64748b', 5, 6.0, 4, 22),
  ('Радуга', '#f472b6', '#4338ca', 5, 6.0, 4, 23)
on conflict (name) do update set center = excluded.center, edge = excluded.edge, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;

insert into public.nft_symbols (name, path, weight, mult, tier, sort) values
  ('Искра', 'M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z', 120, 1.0, 0, 0),
  ('Сердце', 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z', 120, 1.0, 0, 1),
  ('Ромб', 'M12 1l8 11-8 11-8-11z', 120, 1.0, 0, 2),
  ('Капля', 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z', 120, 1.0, 0, 3),
  ('Лист', 'M4 20C4 9 11 3 21 3c0 10-6 17-17 17z', 120, 1.0, 0, 4),
  ('Звезда', 'M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z', 70, 1.3, 1, 5),
  ('Луна', 'M15 2a10 10 0 1 0 7 14A8 8 0 0 1 15 2z', 70, 1.3, 1, 6),
  ('Клевер', 'M7.50 7.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0zM2.50 12.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0zM12.50 12.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0zM7.50 17.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0z', 70, 1.3, 1, 7),
  ('Цветок', 'M13.50 12.00a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM10.75 16.76a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM5.25 16.76a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM2.50 12.00a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM5.25 7.24a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM10.75 7.24a4 4 0 1 0 8 0a4 4 0 1 0 -8 0zM8.50 12.00a3.5 3.5 0 1 0 7.0 0a3.5 3.5 0 1 0 -7.0 0z', 70, 1.3, 1, 8),
  ('Кольцо', 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 1 1 0-12z', 70, 1.3, 1, 9),
  ('Молния', 'M13 1L4 14h7l-2 9 9-13h-7z', 35, 2.0, 2, 10),
  ('Снежинка', 'M10.70 1.00L13.30 1.00L13.30 23.00L10.70 23.00zM20.88 5.37L22.18 7.63L3.12 18.63L1.82 16.37zM22.18 16.37L20.88 18.63L1.82 7.63L3.12 5.37zM17.13 16.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM10.20 20.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM3.27 16.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM3.27 8.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM10.20 4.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM17.13 8.00a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0z', 35, 2.0, 2, 11),
  ('Нота', 'M9 3v12.3A3.5 3.5 0 1 0 11 18.5V8h8V3z', 35, 2.0, 2, 12),
  ('Лапка', 'M6.50 15.50a5.5 5.5 0 1 0 11.0 0a5.5 5.5 0 1 0 -11.0 0zM2.90 9.50a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM6.90 5.00a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM11.90 5.00a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM15.90 9.50a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z', 35, 2.0, 2, 13),
  ('Вишня', 'M2.50 17.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0zM12.50 17.00a4.5 4.5 0 1 0 9.0 0a4.5 4.5 0 1 0 -9.0 0zM7.00 13.00L8.00 13.00L13.00 3.00L12.00 2.00zM16.00 13.00L17.00 13.00L13.00 3.00L12.00 4.00z', 35, 2.0, 2, 14),
  ('Пламя', 'M12 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z', 14, 3.5, 3, 15),
  ('Солнце', 'M6.50 12.00a5.5 5.5 0 1 0 11.0 0a5.5 5.5 0 1 0 -11.0 0zM19.34 10.44L23.50 12.00L19.34 13.56zM18.29 16.08L20.13 20.13L16.08 18.29zM13.56 19.34L12.00 23.50L10.44 19.34zM7.92 18.29L3.87 20.13L5.71 16.08zM4.66 13.56L0.50 12.00L4.66 10.44zM5.71 7.92L3.87 3.87L7.92 5.71zM10.44 4.66L12.00 0.50L13.56 4.66zM16.08 5.71L20.13 3.87L18.29 7.92z', 14, 3.5, 3, 16),
  ('Кристалл', 'M12 1l9 5v12l-9 5-9-5V6z', 14, 3.5, 3, 17),
  ('Щит', 'M12 1l9 4v6c0 6-4 10-9 12C7 21 3 17 3 11V5z', 14, 3.5, 3, 18),
  ('Корона', 'M3 19l-1-12 6 5 4-9 4 9 6-5-1 12z', 5, 6.0, 4, 19),
  ('Звездопад', 'M8 2l1.6 5L15 8.6 9.6 10.2 8 15 6.4 10.2 1 8.6 6.4 7zM18 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z', 5, 6.0, 4, 20),
  ('Волна', 'M2 13c3-4 5-4 8 0s5 4 8 0 3-3 4-2v5c-2-1-2 2-4 2s-5-4-8 0-5 4-8 0z', 5, 6.0, 4, 21)
on conflict (name) do update set path = excluded.path, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;


-- Старые NFT: символы → названия, и оценка стоимости
update public.user_gifts set pattern = case pattern
    when '✦' then 'Искра' when '❄' then 'Снежинка' when '⚡' then 'Молния' when '☾' then 'Луна'
    when '✿' then 'Цветок' when '◆' then 'Ромб' when '♛' then 'Корона' when '✺' then 'Солнце' else pattern end
  where is_collectible and pattern in ('✦', '❄', '⚡', '☾', '✿', '◆', '♛', '✺');

update public.user_gifts ug set value = sub.v
from (
  select u.id, (round(gc.price * coalesce(m.mult, 1) * coalesce(b.mult, 1) * coalesce(s.mult, 1)) + 25)::bigint as v
  from public.user_gifts u
  join public.gift_catalog gc on gc.id = u.gift_id
  left join public.nft_models m on m.name = u.model
  left join public.nft_backdrops b on b.name = u.backdrop
  left join public.nft_symbols s on s.name = u.pattern
  where u.is_collectible
) sub
where ug.id = sub.id and ug.value is null;

-- Случайный выбор с учётом редкости
create or replace function public._pick_model() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_models order by -ln(1 - random()) / weight limit 1;
$$;
create or replace function public._pick_backdrop() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_backdrops order by -ln(1 - random()) / weight limit 1;
$$;
create or replace function public._pick_symbol() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_symbols order by -ln(1 - random()) / weight limit 1;
$$;

-- Превратить подарок в NFT (без оплаты — внутренняя функция)
create or replace function public._upgrade(p_ug uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; num int; m text; b text; s text; v bigint;
begin
  select ug.*, gc.price into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'Подарок уже улучшен'; end if;
  perform 1 from public.gift_catalog where id = r.gift_id for update;
  select coalesce(max(collectible_no), 0) + 1 into num from public.user_gifts where gift_id = r.gift_id;
  m := public._pick_model(); b := public._pick_backdrop(); s := public._pick_symbol();
  select (round(r.price * mm.mult * bb.mult * ss.mult) + 25)::bigint into v
    from public.nft_models mm, public.nft_backdrops bb, public.nft_symbols ss
    where mm.name = m and bb.name = b and ss.name = s;
  update public.user_gifts set is_collectible = true, collectible_no = num, upgraded_at = now(),
    model = m, backdrop = b, pattern = s, value = v
  where id = p_ug;
end $$;

create or replace function public.upgrade_gift(p_ug uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select ug.*, gc.name, gc.upgrade_price into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug and ug.owner_id = auth.uid() for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'Подарок уже улучшен'; end if;
  perform public._coins(auth.uid(), -coalesce(r.upgrade_price, 25), 'Улучшение «' || r.name || '» до NFT');
  perform public._upgrade(p_ug);
  return p_ug;
end $$;

-- Покупка подарка (можно сразу улучшить до NFT за +25)
drop function if exists public.buy_gift(int, uuid, text);
create or replace function public.buy_gift(p_gift int, p_to uuid default null, p_message text default '', p_upgrade boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); g record; ug uuid; cid uuid; cost bigint; r record;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  p_to := coalesce(p_to, me);
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'Получатель не найден'; end if;
  update public.gift_catalog set sold = sold + 1
    where id = p_gift and (total_supply is null or sold < total_supply)
    returning * into g;
  if g.id is null then raise exception 'Этот подарок закончился'; end if;
  cost := g.price + case when p_upgrade then coalesce(g.upgrade_price, 25) else 0 end;
  perform public._coins(me, -cost, 'Подарок «' || g.name || '»' || case when p_upgrade then ' + NFT' else '' end);
  insert into public.user_gifts (gift_id, owner_id, sender_id, message, serial)
    values (g.id, p_to, me, coalesce(left(p_message, 255), ''), g.sold)
    returning id into ug;
  if p_upgrade then perform public._upgrade(ug); end if;
  if p_to <> me then
    cid := public._direct_between(me, p_to);
    select collectible_no into r from public.user_gifts where id = ug;
    insert into public.messages (chat_id, sender_id, kind, text, meta)
    values (cid, me, 'gift', coalesce(left(p_message, 255), ''),
      jsonb_build_object('user_gift', ug, 'gift_id', g.id, 'emoji', g.emoji,
        'name', g.name || case when p_upgrade then ' #' || r.collectible_no else '' end,
        'price', g.price, 'nft', p_upgrade));
  end if;
  return ug;
end $$;

-- =====================================================================
-- 3. ПОСТЫ: счётчики лайков, комментариев и пересылок
-- =====================================================================
alter table public.posts add column if not exists like_count    int not null default 0;
alter table public.posts add column if not exists comment_count int not null default 0;
alter table public.posts add column if not exists share_count   int not null default 0;

create or replace function public._post_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'likes' then
    if tg_op = 'INSERT' then update public.posts set like_count = like_count + 1 where id = new.post_id;
    else update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id; end if;
  else
    if tg_op = 'INSERT' then update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    else update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id; end if;
  end if;
  return null;
end $$;
drop trigger if exists likes_count on public.likes;
create trigger likes_count after insert or delete on public.likes for each row execute function public._post_counts();
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments for each row execute function public._post_counts();

update public.posts p set
  like_count = (select count(*) from public.likes l where l.post_id = p.id),
  comment_count = (select count(*) from public.comments c where c.post_id = p.id);

drop policy if exists "Админ удаляет посты" on public.posts;
create policy "Админ удаляет посты" on public.posts for delete to authenticated using (public.is_admin());
drop policy if exists "Админ удаляет комменты" on public.comments;
create policy "Админ удаляет комменты" on public.comments for delete to authenticated using (public.is_admin());

-- =====================================================================
-- 4. ЧАТЫ ПОДДЕРЖКИ
-- =====================================================================
alter table public.chats drop constraint if exists chats_type_check;
alter table public.chats add constraint chats_type_check check (type in ('direct', 'group', 'channel', 'support'));
alter table public.chats add column if not exists support_user uuid unique references public.profiles(id) on delete cascade;

create or replace function public.is_support_chat(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chats where id = c and type = 'support');
$$;

create or replace function public.is_chat_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m where m.chat_id = c and m.user_id = auth.uid())
    or (public.is_admin() and public.is_support_chat(c));
$$;

create or replace function public.can_post(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_members m join public.chats ch on ch.id = m.chat_id
    where m.chat_id = c and m.user_id = auth.uid()
      and (ch.type <> 'channel' or m.role in ('owner', 'admin'))
  ) or (public.is_admin() and public.is_support_chat(c));
$$;

create or replace function public._support_chat_for(u uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.chats where support_user = u;
  if cid is null then
    insert into public.chats (type, title, description, support_user, created_by)
      values ('support', 'Поддержка Sierra', 'Здесь можно задать вопрос администрации', u, u)
      on conflict (support_user) do nothing returning id into cid;
    if cid is null then select id into cid from public.chats where support_user = u; end if;
    insert into public.chat_members (chat_id, user_id) values (cid, u) on conflict do nothing;
    insert into public.messages (chat_id, sender_id, kind, text)
      values (cid, null, 'system', 'Здравствуйте! Опишите вопрос или проблему — администрация ответит прямо здесь.');
  end if;
  return cid;
end $$;

create or replace function public.get_support_chat()
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  return public._support_chat_for(auth.uid());
end $$;

-- =====================================================================
-- 5. СООБЩЕНИЯ: посты в чатах, реакции, пересылка
-- =====================================================================
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'gift', 'coins', 'system', 'post'));

drop policy if exists "Админ удаляет сообщения" on public.messages;
create policy "Админ удаляет сообщения" on public.messages for delete to authenticated using (public.is_admin());

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_msg_idx on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full;

create or replace function public._msg_chat(m bigint)
returns uuid language sql stable security definer set search_path = '' as $$
  select chat_id from public.messages where id = m;
$$;

drop policy if exists "Видеть реакции" on public.message_reactions;
create policy "Видеть реакции" on public.message_reactions for select to authenticated
  using (public.is_chat_member(public._msg_chat(message_id)));
drop policy if exists "Ставить реакцию" on public.message_reactions;
create policy "Ставить реакцию" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(public._msg_chat(message_id)));
drop policy if exists "Менять реакцию" on public.message_reactions;
create policy "Менять реакцию" on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Убирать реакцию" on public.message_reactions;
create policy "Убирать реакцию" on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Переслать сообщения в другие чаты
create or replace function public.forward_messages(p_ids bigint[], p_chats uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c uuid; m record; n int := 0; src record; fwd jsonb;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or coalesce(array_length(p_chats, 1), 0) = 0 then return 0; end if;
  if array_length(p_ids, 1) > 50 or array_length(p_chats, 1) > 20 then raise exception 'Слишком много за один раз'; end if;
  foreach c in array p_chats loop
    if not public.can_post(c) then continue; end if;
    for m in select * from public.messages where id = any(p_ids) and kind in ('text', 'image', 'post') order by id loop
      if not public.is_chat_member(m.chat_id) then continue; end if;
      if m.meta ? 'fwd_name' then
        fwd := jsonb_build_object('fwd_name', m.meta->>'fwd_name', 'fwd_username', m.meta->>'fwd_username', 'fwd_chat', m.meta->>'fwd_chat');
      else
        select ch.type, ch.title, ch.username, p.username as u_name, p.display_name into src
          from public.chats ch left join public.profiles p on p.id = m.sender_id where ch.id = m.chat_id;
        if src.type = 'channel' then
          fwd := jsonb_build_object('fwd_name', src.title, 'fwd_username', src.username, 'fwd_chat', m.chat_id);
        else
          fwd := jsonb_build_object('fwd_name', coalesce(src.display_name, 'Пользователь'), 'fwd_username', src.u_name, 'fwd_chat', null);
        end if;
      end if;
      insert into public.messages (chat_id, sender_id, kind, text, image_url, meta)
        values (c, me, m.kind, m.text, m.image_url, coalesce(m.meta, '{}'::jsonb) || fwd);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Поделиться постом в чатах
create or replace function public.share_post(p_post uuid, p_chats uuid[], p_text text default '')
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c uuid; n int := 0;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if not exists (select 1 from public.posts where id = p_post) then raise exception 'Пост не найден'; end if;
  if coalesce(array_length(p_chats, 1), 0) > 20 then raise exception 'Слишком много чатов'; end if;
  foreach c in array coalesce(p_chats, '{}') loop
    if not public.can_post(c) then continue; end if;
    insert into public.messages (chat_id, sender_id, kind, text, meta)
      values (c, me, 'post', coalesce(left(p_text, 1000), ''), jsonb_build_object('post_id', p_post));
    n := n + 1;
  end loop;
  update public.posts set share_count = share_count + n where id = p_post;
  return n;
end $$;

-- =====================================================================
-- 6. ЖАЛОБЫ
-- =====================================================================
create table if not exists public.reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  target_type  text not null check (target_type in ('user', 'message', 'post', 'chat')),
  target_id    text not null,
  target_user  uuid references public.profiles(id) on delete set null,
  reason       text not null check (char_length(reason) between 1 and 100),
  details      text not null default '' check (char_length(details) <= 1000),
  snapshot     jsonb,
  status       text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  admin_reply  text,
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "Свои жалобы и админ" on public.reports;
create policy "Свои жалобы и админ" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create or replace function public.create_report(p_type text, p_target text, p_reason text, p_details text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); tu uuid; snap jsonb; rid bigint; r record;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Слишком много жалоб. Попробуй позже';
  end if;
  if p_type = 'user' then
    select id, username, display_name, bio into r from public.profiles where id = p_target::uuid;
    if r.id is null then raise exception 'Пользователь не найден'; end if;
    tu := r.id; snap := jsonb_build_object('username', r.username, 'name', r.display_name, 'bio', r.bio);
  elsif p_type = 'message' then
    select id, chat_id, sender_id, kind, text, image_url into r from public.messages where id = p_target::bigint;
    if r.id is null or not public.is_chat_member(r.chat_id) then raise exception 'Сообщение не найдено'; end if;
    tu := r.sender_id; snap := jsonb_build_object('text', r.text, 'image_url', r.image_url, 'kind', r.kind, 'chat_id', r.chat_id);
  elsif p_type = 'post' then
    select id, author_id, text, image_url into r from public.posts where id = p_target::uuid;
    if r.id is null then raise exception 'Пост не найден'; end if;
    tu := r.author_id; snap := jsonb_build_object('text', r.text, 'image_url', r.image_url);
  elsif p_type = 'chat' then
    select id, created_by, title, username, description into r from public.chats where id = p_target::uuid;
    if r.id is null then raise exception 'Чат не найден'; end if;
    tu := r.created_by; snap := jsonb_build_object('title', r.title, 'username', r.username, 'description', r.description);
  else
    raise exception 'Неверный тип жалобы';
  end if;
  if tu = me then raise exception 'Нельзя пожаловаться на себя'; end if;
  select id into rid from public.reports
    where reporter_id = me and target_type = p_type and target_id = p_target and status = 'open';
  if rid is not null then return rid; end if;
  insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details, snapshot)
    values (me, p_type, p_target, tu, left(coalesce(p_reason, 'Другое'), 100), left(coalesce(p_details, ''), 1000), snap)
    returning id into rid;
  return rid;
end $$;

-- =====================================================================
-- 7. ЗАЩИТА: заблокированные не могут ничего делать (кроме поддержки)
-- =====================================================================
create or replace function public._block_banned()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.bans where user_id = auth.uid()) then return new; end if;
  -- в поддержку писать можно всегда
  if tg_table_name in ('messages', 'chat_members') then
    if public.is_support_chat((to_jsonb(new) ->> 'chat_id')::uuid) then return new; end if;
  elsif tg_table_name = 'chats' then
    if to_jsonb(new) ->> 'type' = 'support' then return new; end if;
  end if;
  raise exception 'Аккаунт заблокирован';
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'likes', 'contacts', 'messages', 'message_reactions',
                           'chats', 'chat_members', 'user_gifts', 'coin_tx', 'reports'] loop
    execute format('drop trigger if exists block_banned on public.%I', t);
    if t = 'user_gifts' then
      execute format('create trigger block_banned before insert or update on public.%I for each row execute function public._block_banned()', t);
    else
      execute format('create trigger block_banned before insert on public.%I for each row execute function public._block_banned()', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- 8. АДМИН-ФУНКЦИИ
-- =====================================================================
create or replace function public._support_notice(u uuid, txt text)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  cid := public._support_chat_for(u);
  insert into public.messages (chat_id, sender_id, kind, text) values (cid, auth.uid(), 'text', txt);
end $$;

create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return json_build_object(
    'users',          (select count(*) from public.profiles),
    'active_today',   (select count(*) from public.profiles where last_seen > now() - interval '1 day'),
    'messages',       (select count(*) from public.messages),
    'posts',          (select count(*) from public.posts),
    'gifts',          (select count(*) from public.user_gifts),
    'nfts',           (select count(*) from public.user_gifts where is_collectible),
    'coins',          (select coalesce(sum(balance), 0) from public.wallets),
    'banned',         (select count(*) from public.bans),
    'open_reports',   (select count(*) from public.reports where status = 'open'),
    'support_waiting', (
      select count(*) from public.chats c
      where c.type = 'support' and (
        select m.sender_id from public.messages m where m.chat_id = c.id and m.kind <> 'system' order by m.id desc limit 1
      ) = c.support_user)
  );
end $$;

create or replace function public.admin_users(p_q text default '')
returns table (
  id uuid, username text, display_name text, avatar_url text, email text, phone text,
  balance bigint, is_banned boolean, ban_reason text, is_admin boolean, created_at timestamptz, last_seen timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare s text := '%' || lower(trim(leading '@' from coalesce(trim(p_q), ''))) || '%';
begin
  perform public._require_admin();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, i.email, i.phone,
      coalesce(w.balance, 0), b.user_id is not null, b.reason, a.user_id is not null, p.created_at, p.last_seen
    from public.profiles p
    left join public.private_info i on i.user_id = p.id
    left join public.wallets w on w.user_id = p.id
    left join public.bans b on b.user_id = p.id
    left join public.admins a on a.user_id = p.id
    where coalesce(p_q, '') = '' or lower(p.username) like s or lower(p.display_name) like s or lower(coalesce(i.email, '')) like s
    order by p.created_at desc
    limit 60;
end $$;

create or replace function public.admin_give_coins(p_username text, p_amount bigint, p_note text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid; nb bigint; note text := coalesce(nullif(trim(p_note), ''), '');
begin
  perform public._require_admin();
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000000 then raise exception 'Сумма от 1 до 100 000 000'; end if;
  select id into u from public.profiles where username = lower(trim(leading '@' from trim(p_username)));
  if u is null then raise exception 'Пользователь @% не найден', trim(leading '@' from trim(p_username)); end if;
  insert into public.wallets (user_id, balance) values (u, 0) on conflict (user_id) do nothing;
  perform public._coins(u, p_amount,
    case when p_amount > 0 then 'Начисление от администрации' else 'Списание администрацией' end
    || case when note <> '' then ': ' || note else '' end);
  select balance into nb from public.wallets where user_id = u;
  if u <> auth.uid() then
    perform public._support_notice(u,
      case when p_amount > 0 then '🪙 Администрация начислила вам ' || p_amount || ' SierCoin'
           else '🪙 Администрация списала ' || abs(p_amount) || ' SierCoin' end
      || case when note <> '' then '. Комментарий: ' || note else '' end);
  end if;
  return nb;
end $$;

create or replace function public.admin_ban(p_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if p_user = auth.uid() then raise exception 'Нельзя заблокировать себя'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Нельзя заблокировать администратора'; end if;
  insert into public.bans (user_id, reason, banned_by) values (p_user, coalesce(p_reason, ''), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  update public.user_gifts set sale_price = null where owner_id = p_user and sale_price is not null;
  perform public._support_notice(p_user, '⛔ Ваш аккаунт заблокирован.'
    || case when coalesce(p_reason, '') <> '' then ' Причина: ' || p_reason || '.' else '' end
    || ' Если считаете это ошибкой — напишите сюда.');
end $$;

create or replace function public.admin_unban(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  delete from public.bans where user_id = p_user;
  perform public._support_notice(p_user, '✅ Ваш аккаунт разблокирован. Добро пожаловать обратно!');
end $$;

create or replace function public.admin_reports(p_status text default 'open')
returns table (
  id bigint, target_type text, target_id text, reason text, details text, snapshot jsonb, status text,
  admin_reply text, created_at timestamptz, resolved_at timestamptz,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_user uuid, target_username text, target_name text, target_banned boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.snapshot, r.status, r.admin_reply, r.created_at, r.resolved_at,
      r.reporter_id, rp.username, rp.display_name, r.target_user, tp.username, tp.display_name,
      exists (select 1 from public.bans b where b.user_id = r.target_user)
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.target_user
    where coalesce(p_status, 'all') = 'all' or r.status = p_status
    order by r.created_at desc
    limit 100;
end $$;

create or replace function public.admin_resolve_report(p_id bigint, p_status text, p_reply text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  perform public._require_admin();
  if p_status not in ('open', 'resolved', 'rejected') then raise exception 'Неверный статус'; end if;
  update public.reports set status = p_status, admin_reply = nullif(trim(p_reply), ''),
    resolved_by = auth.uid(), resolved_at = case when p_status = 'open' then null else now() end
    where id = p_id returning * into r;
  if r.id is null then raise exception 'Жалоба не найдена'; end if;
  if coalesce(trim(p_reply), '') <> '' and r.reporter_id is not null then
    perform public._support_notice(r.reporter_id, '📋 Ответ на вашу жалобу №' || r.id || ': ' || trim(p_reply));
  end if;
end $$;

create or replace function public.admin_support_chats()
returns table (
  chat_id uuid, user_id uuid, username text, display_name text, avatar_url text,
  last_text text, last_kind text, last_at timestamptz, waiting boolean, total bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
    select c.id, p.id, p.username, p.display_name, p.avatar_url,
      lm.text, lm.kind, coalesce(lm.created_at, c.created_at),
      coalesce(lm.sender_id = c.support_user, false),
      (select count(*) from public.messages m where m.chat_id = c.id and m.kind <> 'system')
    from public.chats c
    join public.profiles p on p.id = c.support_user
    left join lateral (
      select m.text, m.kind, m.sender_id, m.created_at from public.messages m
      where m.chat_id = c.id and m.kind <> 'system' order by m.id desc limit 1
    ) lm on true
    where c.type = 'support'
    order by coalesce(lm.sender_id = c.support_user, false) desc, coalesce(lm.created_at, c.created_at) desc
    limit 200;
end $$;

-- =====================================================================
-- 9. ПРАВА, РЕАЛЬНОЕ ВРЕМЯ, ВНУТРЕННИЕ ФУНКЦИИ
-- =====================================================================
grant select on public.nft_models, public.nft_backdrops, public.nft_symbols to anon, authenticated;
grant select on public.admins, public.bans, public.reports to authenticated;
grant select, insert, update, delete on public.message_reactions to authenticated;

revoke execute on function public._upgrade(uuid) from public, anon, authenticated;
revoke execute on function public._pick_model() from public, anon, authenticated;
revoke execute on function public._pick_backdrop() from public, anon, authenticated;
revoke execute on function public._pick_symbol() from public, anon, authenticated;
revoke execute on function public._support_chat_for(uuid) from public, anon, authenticated;
revoke execute on function public._support_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public._post_counts() from public, anon, authenticated;
revoke execute on function public._block_banned() from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.my_ban(), public.upgrade_gift(uuid), public.buy_gift(int, uuid, text, boolean),
  public.get_support_chat(), public.is_support_chat(uuid), public.is_chat_member(uuid), public.can_post(uuid),
  public._msg_chat(bigint), public.forward_messages(bigint[], uuid[]), public.share_post(uuid, uuid[], text),
  public.create_report(text, text, text, text), public._require_admin(),
  public.admin_stats(), public.admin_users(text), public.admin_give_coins(text, bigint, text),
  public.admin_ban(uuid, text), public.admin_unban(uuid), public.admin_reports(text),
  public.admin_resolve_report(bigint, text, text), public.admin_support_chats()
to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Если ты видишь «Success» — этап 3 установлен! 🎉
