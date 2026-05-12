-- ============================================================
-- Enums
-- ============================================================

create type user_role as enum ('professor', 'ta', 'student');
create type session_status as enum ('pending', 'in_progress', 'completed');
create type message_role as enum ('ai', 'student');

-- ============================================================
-- profiles
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')::user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS: users see only their own profile
create policy "profiles: own row" on profiles
  for select using (id = auth.uid());

create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

-- ============================================================
-- assignments
-- ============================================================

create table assignments (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references profiles on delete cascade,
  title         text not null,
  description   text not null,
  rubric        text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table assignments enable row level security;

-- Professors manage their own; students can read any (accessed via link)
create policy "assignments: professor crud" on assignments
  for all using (professor_id = auth.uid());

create policy "assignments: student read" on assignments
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('student', 'ta'))
  );

-- ============================================================
-- questions
-- ============================================================

create table questions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments on delete cascade,
  content        text not null,
  order_index    integer not null
);

alter table questions enable row level security;

create policy "questions: professor crud" on questions
  for all using (
    exists (select 1 from assignments where id = assignment_id and professor_id = auth.uid())
  );

create policy "questions: student/ta read" on questions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('student', 'ta'))
  );

-- ============================================================
-- submissions
-- ============================================================

create table submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments on delete cascade,
  student_id     uuid not null references profiles on delete cascade,
  code           text not null,
  submitted_at   timestamptz not null default now()
);

alter table submissions enable row level security;

create policy "submissions: student insert own" on submissions
  for insert with check (student_id = auth.uid());

create policy "submissions: student read own" on submissions
  for select using (student_id = auth.uid());

create policy "submissions: professor read" on submissions
  for select using (
    exists (select 1 from assignments where id = assignment_id and professor_id = auth.uid())
  );

create policy "submissions: ta read" on submissions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ta')
  );

-- ============================================================
-- sessions
-- ============================================================

create table sessions (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references submissions on delete cascade,
  status         session_status not null default 'pending',
  started_at     timestamptz,
  ended_at       timestamptz
);

alter table sessions enable row level security;

create policy "sessions: student insert own" on sessions
  for insert with check (
    exists (select 1 from submissions where id = submission_id and student_id = auth.uid())
  );

create policy "sessions: student read own" on sessions
  for select using (
    exists (select 1 from submissions where id = submission_id and student_id = auth.uid())
  );

create policy "sessions: student update own" on sessions
  for update using (
    exists (select 1 from submissions where id = submission_id and student_id = auth.uid())
  );

create policy "sessions: professor read" on sessions
  for select using (
    exists (
      select 1 from submissions s
      join assignments a on a.id = s.assignment_id
      where s.id = submission_id and a.professor_id = auth.uid()
    )
  );

create policy "sessions: ta read" on sessions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ta')
  );

-- ============================================================
-- messages
-- ============================================================

create table messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions on delete cascade,
  role        message_role not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table messages enable row level security;

create policy "messages: student insert own" on messages
  for insert with check (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      where se.id = session_id and su.student_id = auth.uid()
    )
  );

create policy "messages: student read own" on messages
  for select using (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      where se.id = session_id and su.student_id = auth.uid()
    )
  );

create policy "messages: professor read" on messages
  for select using (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      join assignments a on a.id = su.assignment_id
      where se.id = session_id and a.professor_id = auth.uid()
    )
  );

create policy "messages: ta read" on messages
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ta')
  );

-- ============================================================
-- reports
-- ============================================================

create table reports (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions on delete cascade,
  summary           text,
  rubric_alignment  jsonb,
  suggested_score   numeric(5, 2),
  final_score       numeric(5, 2),
  reviewed_by       uuid references profiles,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table reports enable row level security;

create policy "reports: student read own" on reports
  for select using (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      where se.id = session_id and su.student_id = auth.uid()
    )
  );

create policy "reports: professor read" on reports
  for select using (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      join assignments a on a.id = su.assignment_id
      where se.id = session_id and a.professor_id = auth.uid()
    )
  );

create policy "reports: professor update final score" on reports
  for update using (
    exists (
      select 1 from sessions se
      join submissions su on su.id = se.submission_id
      join assignments a on a.id = su.assignment_id
      where se.id = session_id and a.professor_id = auth.uid()
    )
  );

create policy "reports: ta read" on reports
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ta')
  );

create policy "reports: ta update final score" on reports
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ta')
  );

-- Service role (used by API routes) can insert reports
create policy "reports: service insert" on reports
  for insert with check (true);
