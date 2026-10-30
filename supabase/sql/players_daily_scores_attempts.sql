-- The Players: a day's attempt is saved when the game starts, not when it ends.
-- Before this, the score was only saved on the final score screen, so closing the
-- app after a wrong answer (which shows the right one) gave another go at the
-- same puzzle. Now the row is written at kick-off and raised after each answer;
-- an attempt that is never finished keeps the score it had.
--
-- Run after players_daily_scores.sql. Safe to run more than once.
-- Older app builds keep working: they insert a finished row when they reach the
-- score screen, and the insert-only policy on the table is unchanged.

alter table public.players_daily_scores
  add column if not exists finished boolean not null default true;

comment on column public.players_daily_scores.finished is
  'False while an attempt is in progress. An unfinished attempt can only be raised and then finished by its player, through players_record_days.';

-- Claims the day for the signed-in player. False if they already have an attempt for it.
create or replace function public.players_start_day(p_day_key text, p_total integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.players_daily_scores (user_id, day_key, correct, total, finished)
  values (auth.uid(), p_day_key, 0, p_total, false)
  on conflict (user_id, day_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

-- Saves the signed-in player's scores: [{ "day_key", "correct", "total", "finished" }].
-- New days are inserted. An unfinished attempt can only go up and can only be
-- finished, never reopened. Finished days are never changed.
create or replace function public.players_record_days(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.players_daily_scores as s (user_id, day_key, correct, total, finished)
  select auth.uid(), r.day_key, r.correct, r.total, coalesce(r.finished, true)
  from jsonb_to_recordset(p_rows) as r(day_key text, correct integer, total integer, finished boolean)
  on conflict (user_id, day_key) do update
    set correct = greatest(s.correct, least(excluded.correct, s.total)),
        finished = s.finished or excluded.finished
    where s.finished = false;
end;
$$;

revoke all on function public.players_start_day(text, integer) from public, anon;
revoke all on function public.players_record_days(jsonb) from public, anon;
grant execute on function public.players_start_day(text, integer) to authenticated;
grant execute on function public.players_record_days(jsonb) to authenticated;
