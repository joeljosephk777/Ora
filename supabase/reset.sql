-- Run this in Supabase SQL Editor to wipe all app tables and start fresh.
-- After running this, run 001_initial_schema.sql to recreate everything.

drop policy if exists "profiles: own row" on profiles;
drop policy if exists "profiles: update own" on profiles;
drop policy if exists "assignments: professor crud" on assignments;
drop policy if exists "assignments: student read" on assignments;
drop policy if exists "questions: professor crud" on questions;
drop policy if exists "questions: student/ta read" on questions;
drop policy if exists "submissions: student insert own" on submissions;
drop policy if exists "submissions: student read own" on submissions;
drop policy if exists "submissions: professor read" on submissions;
drop policy if exists "submissions: ta read" on submissions;
drop policy if exists "sessions: student insert own" on sessions;
drop policy if exists "sessions: student read own" on sessions;
drop policy if exists "sessions: student update own" on sessions;
drop policy if exists "sessions: professor read" on sessions;
drop policy if exists "sessions: ta read" on sessions;
drop policy if exists "messages: student insert own" on messages;
drop policy if exists "messages: student read own" on messages;
drop policy if exists "messages: professor read" on messages;
drop policy if exists "messages: ta read" on messages;
drop policy if exists "reports: student read own" on reports;
drop policy if exists "reports: professor read" on reports;
drop policy if exists "reports: professor update final score" on reports;
drop policy if exists "reports: ta read" on reports;
drop policy if exists "reports: ta update final score" on reports;
drop policy if exists "reports: service insert" on reports;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

drop table if exists reports cascade;
drop table if exists messages cascade;
drop table if exists sessions cascade;
drop table if exists submissions cascade;
drop table if exists questions cascade;
drop table if exists assignments cascade;
drop table if exists profiles cascade;

drop type if exists message_role;
drop type if exists session_status;
drop type if exists user_role;
