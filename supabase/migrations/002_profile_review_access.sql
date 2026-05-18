create policy "profiles: professor read assignment students" on profiles
  for select using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'professor'
    and exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      where s.student_id = profiles.id and a.professor_id = auth.uid()
    )
  );

create policy "profiles: ta read all" on profiles
  for select using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'ta'
  );
