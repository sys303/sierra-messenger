-- =====================================================================
-- Sierra Messenger — ЭТАП 4
-- Коллекционные юзернеймы и их маркет, подарки от администрации,
-- живой счётчик подарков. Запускать ПОСЛЕ stage3. Можно повторно.
-- =====================================================================

-- =====================================================================
-- 1. ЮЗЕРНЕЙМЫ: у одного человека может быть несколько (основной + «also»)
-- =====================================================================
create table if not exists public.usernames (
  name       text primary key check (name ~ '^[a-z0-9_]{3,20}$'),
  len        int generated always as (char_length(name)) stored,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  sale_price bigint check (sale_price between 1 and 100000000),
  listed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists usernames_owner_idx on public.usernames(owner_id, created_at);
create index if not exists usernames_sale_idx on public.usernames(len, sale_price) where sale_price is not null;
alter table public.usernames enable row level security;
drop policy if exists "Юзернеймы видны всем" on public.usernames;
create policy "Юзернеймы видны всем" on public.usernames for select using (true);

-- Все текущие ники — во владении своих хозяев
insert into public.usernames (name, owner_id)
  select p.username, p.id from public.profiles p
  on conflict (name) do nothing;

-- Ник в профиле может быть только своим (или свободным — тогда он становится твоим)
create or replace function public._profile_username_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.username := lower(new.username);
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
  if exists (select 1 from public.usernames where name = new.username and owner_id <> new.id) then
    raise exception 'Этот ник уже занят';
  end if;
  if exists (select 1 from public.chats where username = new.username) then
    raise exception 'Этот ник занят группой или каналом';
  end if;
  return new;
end $$;
drop trigger if exists profile_username_check on public.profiles;
create trigger profile_username_check before insert or update of username on public.profiles
  for each row execute function public._profile_username_check();

create or replace function public._profile_username_own()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usernames (name, owner_id) values (new.username, new.id) on conflict (name) do nothing;
  return null;
end $$;
drop trigger if exists profile_username_own on public.profiles;
create trigger profile_username_own after insert or update of username on public.profiles
  for each row execute function public._profile_username_own();

-- Ссылки групп и каналов не должны совпадать с чужими юзернеймами
create or replace function public._chat_username_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.username is not null and exists (select 1 from public.usernames where name = new.username) then
    raise exception 'Эта ссылка уже занята';
  end if;
  return new;
end $$;
drop trigger if exists chat_username_check on public.chats;
create trigger chat_username_check before insert or update of username on public.chats
  for each row execute function public._chat_username_check();

-- Занять свободный юзернейм (до 10 штук)
create or replace function public.claim_username(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare n text := lower(trim(leading '@' from trim(p_name)));
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  if n !~ '^[a-z0-9_]{3,20}$' then raise exception 'Юзернейм: 3–20 символов, латиница, цифры и _'; end if;
  if (select count(*) from public.usernames where owner_id = auth.uid()) >= 10 then
    raise exception 'Можно занять не больше 10 юзернеймов. Купи на маркете или освободи лишний';
  end if;
  if exists (select 1 from public.usernames where name = n) or exists (select 1 from public.chats where username = n) then
    raise exception 'Юзернейм @% уже занят', n;
  end if;
  insert into public.usernames (name, owner_id) values (n, auth.uid());
  return n;
end $$;

-- Освободить свой дополнительный юзернейм
create or replace function public.release_username(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and username = p_name) then
    raise exception 'Нельзя освободить основной юзернейм. Сначала сделай основным другой';
  end if;
  delete from public.usernames where name = p_name and owner_id = auth.uid();
  if not found then raise exception 'Это не твой юзернейм'; end if;
end $$;

-- Сделать юзернейм основным (старый остаётся у тебя как «also»)
create or replace function public.set_primary_username(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usernames where name = p_name and owner_id = auth.uid()) then
    raise exception 'Это не твой юзернейм';
  end if;
  update public.profiles set username = p_name where id = auth.uid();
end $$;

-- Выставить на маркет за свою цену (null — снять с продажи)
create or replace function public.list_username(p_name text, p_price bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_price is not null and (p_price < 1 or p_price > 100000000) then raise exception 'Цена от 1 до 100 000 000 SierCoin'; end if;
  update public.usernames set sale_price = p_price, listed_at = case when p_price is null then null else now() end
    where name = p_name and owner_id = auth.uid();
  if not found then raise exception 'Это не твой юзернейм'; end if;
end $$;

-- Купить юзернейм у другого пользователя
create or replace function public.buy_username(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r record; repl text;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  select * into r from public.usernames where name = p_name for update;
  if r.name is null or r.sale_price is null then raise exception 'Этот юзернейм уже не продаётся'; end if;
  if r.owner_id = me then raise exception 'Это твой юзернейм'; end if;
  perform public._coins(me, -r.sale_price, 'Покупка юзернейма @' || r.name);
  perform public._coins(r.owner_id, floor(r.sale_price * 0.95)::bigint, 'Продажа юзернейма @' || r.name || ' (комиссия 5%)');
  update public.usernames set owner_id = me, sale_price = null, listed_at = null, created_at = now() where name = r.name;
  -- если продавец продал свой основной ник — ставим ему другой из его списка
  if exists (select 1 from public.profiles where id = r.owner_id and username = r.name) then
    select name into repl from public.usernames where owner_id = r.owner_id order by created_at limit 1;
    if repl is null then
      loop
        repl := 'user_' || substr(md5(random()::text), 1, 8);
        exit when not exists (select 1 from public.usernames where name = repl);
      end loop;
    end if;
    update public.profiles set username = repl where id = r.owner_id;
  end if;
end $$;

-- =====================================================================
-- 2. ПОДАРКИ ОТ АДМИНИСТРАЦИИ (себе и другим)
-- =====================================================================
create or replace function public.admin_give_gift(p_username text, p_gift int, p_upgrade boolean default false, p_message text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid; g record; ug uuid; cid uuid; num int; n text := lower(trim(leading '@' from trim(p_username)));
begin
  perform public._require_admin();
  select owner_id into u from public.usernames where name = n;
  if u is null then select id into u from public.profiles where username = n; end if;
  if u is null then raise exception 'Пользователь @% не найден', n; end if;
  update public.gift_catalog set sold = sold + 1 where id = p_gift returning * into g;
  if g.id is null then raise exception 'Подарок не найден'; end if;
  insert into public.user_gifts (gift_id, owner_id, sender_id, message, serial)
    values (g.id, u, auth.uid(), coalesce(left(p_message, 255), ''), g.sold)
    returning id into ug;
  if p_upgrade then perform public._upgrade(ug); end if;
  if u <> auth.uid() then
    cid := public._support_chat_for(u);
    select collectible_no into num from public.user_gifts where id = ug;
    insert into public.messages (chat_id, sender_id, kind, text, meta)
    values (cid, auth.uid(), 'gift', coalesce(nullif(left(p_message, 255), ''), 'Подарок от администрации Sierra 🎁'),
      jsonb_build_object('user_gift', ug, 'gift_id', g.id, 'emoji', g.emoji,
        'name', g.name || case when p_upgrade then ' #' || num else '' end, 'nft', p_upgrade, 'from_admin', true));
  end if;
  return ug;
end $$;


-- При блокировке снимаем с продажи и юзернеймы
create or replace function public.admin_ban(p_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if p_user = auth.uid() then raise exception 'Нельзя заблокировать себя'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Нельзя заблокировать администратора'; end if;
  insert into public.bans (user_id, reason, banned_by) values (p_user, coalesce(p_reason, ''), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  update public.user_gifts set sale_price = null where owner_id = p_user and sale_price is not null;
  update public.usernames set sale_price = null, listed_at = null where owner_id = p_user and sale_price is not null;
  perform public._support_notice(p_user, '⛔ Ваш аккаунт заблокирован.'
    || case when coalesce(p_reason, '') <> '' then ' Причина: ' || p_reason || '.' else '' end
    || ' Если считаете это ошибкой — напишите сюда.');
end $$;

-- =====================================================================
-- 3. ЗАЩИТА, ПРАВА, РЕАЛЬНОЕ ВРЕМЯ
-- =====================================================================
drop trigger if exists block_banned on public.usernames;
create trigger block_banned before insert or update on public.usernames
  for each row execute function public._block_banned();

grant select on public.usernames to anon, authenticated;
revoke execute on function public._profile_username_check() from public, anon, authenticated;
revoke execute on function public._profile_username_own() from public, anon, authenticated;
revoke execute on function public._chat_username_check() from public, anon, authenticated;
grant execute on function
  public.claim_username(text), public.release_username(text), public.set_primary_username(text),
  public.list_username(text, bigint), public.buy_username(text),
  public.admin_give_gift(text, int, boolean, text)
to authenticated;

-- Счётчик «Осталось» обновляется у всех сразу
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gift_catalog') then
    alter publication supabase_realtime add table public.gift_catalog;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Если ты видишь «Success» — этап 4 установлен! 🎉
