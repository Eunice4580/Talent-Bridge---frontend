-- Talent Bridge HR Solutions — initial database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── Tables ────────────────────────────────────────────

create table if not exists public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 120),
    email text not null check (char_length(email) between 3 and 254),
    subject text check (char_length(subject) <= 200),
    message text not null check (char_length(message) between 1 and 5000),
    status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
    created_at timestamptz not null default now()
);

create table if not exists public.consultation_requests (
    id uuid primary key default gen_random_uuid(),
    first_name text not null check (char_length(first_name) between 1 and 80),
    last_name text not null check (char_length(last_name) between 1 and 80),
    email text not null check (char_length(email) between 3 and 254),
    phone text not null check (char_length(phone) between 7 and 20),
    service text check (char_length(service) <= 120),
    message text check (char_length(message) <= 5000),
    status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
    created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
    on public.contact_messages (created_at desc);
create index if not exists consultation_requests_created_at_idx
    on public.consultation_requests (created_at desc);

-- Admin allow-list. Add an admin after creating their auth user:
--   insert into public.admins (user_id) values ('<auth-user-id>');
create table if not exists public.admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- ── Admin check ───────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── API privileges ────────────────────────────────────
-- Roles need table privileges to reach the tables at all; RLS still decides which rows they can touch.

grant insert on public.contact_messages to anon, authenticated;
grant insert on public.consultation_requests to anon, authenticated;

grant select, update on public.contact_messages to authenticated;
grant select, update on public.consultation_requests to authenticated;
grant select on public.admins to authenticated;

grant execute on function public.is_admin() to authenticated;

-- ── Row-level security ────────────────────────────────

alter table public.contact_messages enable row level security;
alter table public.consultation_requests enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
    on public.contact_messages for insert
    to anon, authenticated
    with check (true);

drop policy if exists "Public can submit consultation requests" on public.consultation_requests;
create policy "Public can submit consultation requests"
    on public.consultation_requests for insert
    to anon, authenticated
    with check (true);

drop policy if exists "Admins can read contact messages" on public.contact_messages;
create policy "Admins can read contact messages"
    on public.contact_messages for select
    to authenticated
    using (public.is_admin());

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
    on public.contact_messages for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins can read consultation requests" on public.consultation_requests;
create policy "Admins can read consultation requests"
    on public.consultation_requests for select
    to authenticated
    using (public.is_admin());

drop policy if exists "Admins can update consultation requests" on public.consultation_requests;
create policy "Admins can update consultation requests"
    on public.consultation_requests for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins can read the admin list" on public.admins;
create policy "Admins can read the admin list"
    on public.admins for select
    to authenticated
    using (user_id = auth.uid());
