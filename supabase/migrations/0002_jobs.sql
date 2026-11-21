-- Talent Bridge HR Solutions — jobs and applications
-- Run after 0001_init.sql in the Supabase SQL editor.

-- ── Tables ────────────────────────────────────────────

create table if not exists public.job_vacancies (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 2 and 150),
    company text not null check (char_length(company) between 1 and 150),
    location text not null check (char_length(location) between 1 and 120),
    salary_range text check (char_length(salary_range) <= 100),
    employment_type text not null default 'Full-time'
        check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Internship', 'Remote')),
    description text check (char_length(description) <= 5000),
    tags text[] not null default '{}',
    badge text check (badge in ('Featured', 'New', 'Remote')),
    status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
    created_at timestamptz not null default now()
);

create table if not exists public.job_applications (
    id uuid primary key default gen_random_uuid(),
    vacancy_id uuid not null references public.job_vacancies(id) on delete cascade,
    full_name text not null check (char_length(full_name) between 2 and 120),
    email text not null check (char_length(email) between 3 and 254),
    phone text not null check (char_length(phone) between 7 and 20),
    cover_note text check (char_length(cover_note) <= 5000),
    cv_path text not null check (char_length(cv_path) between 1 and 500),
    status text not null default 'new'
        check (status in ('new', 'shortlisted', 'interviewed', 'rejected', 'hired')),
    created_at timestamptz not null default now()
);

create index if not exists job_vacancies_status_created_idx
    on public.job_vacancies (status, created_at desc);
create index if not exists job_applications_vacancy_idx
    on public.job_applications (vacancy_id);
create index if not exists job_applications_created_idx
    on public.job_applications (created_at desc);

-- ── API privileges ────────────────────────────────────

grant select on public.job_vacancies to anon, authenticated;
grant select, insert, update on public.job_vacancies to authenticated;

grant insert on public.job_applications to anon, authenticated;
grant select, update on public.job_applications to authenticated;

-- ── Row-level security ────────────────────────────────

alter table public.job_vacancies enable row level security;
alter table public.job_applications enable row level security;

drop policy if exists "Public can read published vacancies" on public.job_vacancies;
create policy "Public can read published vacancies"
    on public.job_vacancies for select
    to anon, authenticated
    using (status = 'published');

drop policy if exists "Admins can read all vacancies" on public.job_vacancies;
create policy "Admins can read all vacancies"
    on public.job_vacancies for select
    to authenticated
    using (public.is_admin());

drop policy if exists "Admins can create vacancies" on public.job_vacancies;
create policy "Admins can create vacancies"
    on public.job_vacancies for insert
    to authenticated
    with check (public.is_admin());

drop policy if exists "Admins can update vacancies" on public.job_vacancies;
create policy "Admins can update vacancies"
    on public.job_vacancies for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Public can submit applications" on public.job_applications;
create policy "Public can submit applications"
    on public.job_applications for insert
    to anon, authenticated
    with check (
        exists (
            select 1 from public.job_vacancies v
            where v.id = vacancy_id and v.status = 'published'
        )
    );

drop policy if exists "Admins can read applications" on public.job_applications;
create policy "Admins can read applications"
    on public.job_applications for select
    to authenticated
    using (public.is_admin());

drop policy if exists "Admins can update applications" on public.job_applications;
create policy "Admins can update applications"
    on public.job_applications for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ── CV storage ────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'cvs',
    'cvs',
    false,
    5242880,
    array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Candidates can upload CVs" on storage.objects;
create policy "Candidates can upload CVs"
    on storage.objects for insert
    to anon, authenticated
    with check (
        bucket_id = 'cvs'
        and coalesce(metadata->>'mimetype', '') in (
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        and coalesce((metadata->>'size')::bigint, 0) <= 5242880
    );

drop policy if exists "Admins can read CVs" on storage.objects;
create policy "Admins can read CVs"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'cvs' and public.is_admin());

-- ── Seed the current listings (only when the table is empty) ──

insert into public.job_vacancies
    (title, company, location, salary_range, employment_type, description, tags, badge, status)
select *
from (values
    ('HR Manager', 'First National Bank Kenya', 'Nairobi CBD', 'KSh 150,000+', 'Full-time',
     'Lead the HR function for a leading bank, covering strategy, employee relations and workforce planning.',
     array['HR Strategy', 'Leadership', 'Banking'], 'Featured', 'published'),
    ('Talent Acquisition Specialist', 'Safaricom PLC', 'Westlands', 'KSh 80,000+', 'Full-time',
     'Partner with hiring managers to source and close technology and commercial roles.',
     array['Recruitment', 'Tech'], 'New', 'published'),
    ('Payroll Administrator', 'Kenya Power', 'Remote', 'KSh 60,000+', 'Remote',
     'Run monthly payroll and statutory returns for a nationwide utility.',
     array['Payroll', 'Finance'], 'Remote', 'published'),
    ('L&D Coordinator', 'Kenya Airways', 'Embakasi', 'KSh 70,000+', 'Full-time',
     'Coordinate training programmes and learning schedules for airline staff.',
     array['Training', 'L&D'], null, 'published'),
    ('HR Compliance Officer', 'Equity Bank', 'Upper Hill', 'KSh 90,000+', 'Full-time',
     'Keep employment practices aligned with Kenyan labour law and internal policy.',
     array['Compliance', 'Labour Law'], 'New', 'published'),
    ('Senior Recruiter', 'Talent Bridge HR Solutions', 'Westlands', 'KSh 75,000+', 'Full-time',
     'Own end-to-end recruitment for our growing client portfolio.',
     array['Recruitment', 'HR'], null, 'published')
) as seed(title, company, location, salary_range, employment_type, description, tags, badge, status)
where not exists (select 1 from public.job_vacancies);
