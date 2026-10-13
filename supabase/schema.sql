-- =========================================================
-- Sierra Messenger — этап 1: профили и аватарки
-- Вставь весь этот файл в Supabase → SQL Editor → Run
-- =========================================================

-- 1. Таблица профилей
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio          text not null default '' check (char_length(bio) <= 160),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Профили видят все (как в любой соцсети)
drop policy if exists "Профили видны всем" on public.profiles;
create policy "Профили видны всем"
  on public.profiles for select
  using (true);

-- Менять можно только свой профиль
drop policy if exists "Можно менять только свой профиль" on public.profiles;
create policy "Можно менять только свой профиль"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Автоматически создаём профиль при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''),
             new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Хранилище для аватарок
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Аватарки видны всем" on storage.objects;
create policy "Аватарки видны всем"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Загружать аватарку в свою папку" on storage.objects;
create policy "Загружать аватарку в свою папку"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Менять свою аватарку" on storage.objects;
create policy "Менять свою аватарку"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Удалять свою аватарку" on storage.objects;
create policy "Удалять свою аватарку"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
