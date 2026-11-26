-- Спільний шлюз платних операцій (2026-11-26, Phase 02).
-- Платні виклики вимкнені за замовчуванням для ВСІХ (включно з власником). Увімкнення — лише явними ключами в public.settings:
--   paid_<svc>_enabled = 1  і  paid_<svc>_daily_max = N  (одиниць на добу UTC для всіх користувачів разом).
-- paid_reserve(svc) атомарно резервує 1 одиницю ПЕРЕД кожним зверненням до провайдера: одночасні запити не перевищать N
-- (рядок лічильника блокується INSERT … ON CONFLICT DO UPDATE … WHERE used < N). Повтори запиту резервують знову.
-- Викликати може лише service_role (Edge Functions); анонімам і користувачам виконання заборонено.
-- Відкат: див. 20261126_paid_gate_ROLLBACK.sql (повертає job_create, прибирає функцію й таблицю; ключі settings не чіпає).

create table if not exists public.paid_usage (
  day  date    not null,
  svc  text    not null,
  used integer not null default 0 check (used >= 0),
  primary key (day, svc)
);
alter table public.paid_usage enable row level security;   -- політик немає: доступ лише service_role
revoke all on table public.paid_usage from public, anon, authenticated;

create or replace function public.paid_reserve(p_svc text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_en bigint; v_max bigint; v_used integer;
begin
  if p_svc is null or p_svc !~ '^[a-z_]{2,40}$' then return 'bad_svc'; end if;
  select value into v_en  from public.settings where key = 'paid_' || p_svc || '_enabled';
  if coalesce(v_en, 0) <> 1 then return 'paid_disabled'; end if;
  select value into v_max from public.settings where key = 'paid_' || p_svc || '_daily_max';
  if v_max is null or v_max <= 0 then return 'paid_budget_missing'; end if;
  insert into public.paid_usage as u (day, svc, used) values ((now() at time zone 'utc')::date, p_svc, 1)
    on conflict (day, svc) do update set used = u.used + 1 where u.used < v_max
    returning u.used into v_used;
  if v_used is null then return 'paid_budget_exhausted'; end if;
  return 'ok';
end $$;
revoke all on function public.paid_reserve(text) from public, anon, authenticated;
grant execute on function public.paid_reserve(text) to service_role;

-- Черга воркера (ElevenLabs Scribe, Claude): нові платні завдання — лише після явного ввімкнення paid_worker_job_*.
create or replace function public.job_create(p_kind text, p_input jsonb)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_uid uuid := auth.uid(); v_id uuid; v_active int; v_done int; v_tier text; v_owner boolean; v_gate text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('transcribe','montage') then raise exception 'bad_kind'; end if;
  select coalesce(is_owner,false) into v_owner from public.profiles where id = v_uid;
  select count(*) into v_active from public.media_jobs where user_id = v_uid and status in ('queued','working');
  if v_active >= public.setting('jobs_active_max') and not v_owner then raise exception 'too_many_jobs'; end if;
  if p_kind = 'montage' and not v_owner then
    v_tier := public.quota_state(v_uid)->>'tier';
    select count(*) into v_done from public.media_jobs where user_id = v_uid and kind = 'montage' and status = 'done';
    if v_tier <> 'studio' and v_done >= public.setting('montage_free') then raise exception 'need_studio'; end if;
  end if;
  if p_kind = 'transcribe' and coalesce((p_input->>'clone')::boolean, false)
     and not exists (select 1 from public.consents where user_id = v_uid and doc = 'voice') then
    raise exception 'consent_required';
  end if;
  v_gate := public.paid_reserve('worker_job');   -- шлюз платних операцій (для всіх, включно з власником)
  if v_gate <> 'ok' then raise exception '%', v_gate; end if;
  insert into public.media_jobs(user_id, kind, input) values (v_uid, p_kind, coalesce(p_input,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $function$;

-- Перевірка без резервування: щоб відмовити ДО списання безкоштовних квот користувача, якщо платний шлях вимкнено.
create or replace function public.paid_check(p_svc text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_en bigint; v_max bigint; v_used integer;
begin
  if p_svc is null or p_svc !~ '^[a-z_]{2,40}$' then return 'bad_svc'; end if;
  select value into v_en  from public.settings where key = 'paid_' || p_svc || '_enabled';
  if coalesce(v_en, 0) <> 1 then return 'paid_disabled'; end if;
  select value into v_max from public.settings where key = 'paid_' || p_svc || '_daily_max';
  if v_max is null or v_max <= 0 then return 'paid_budget_missing'; end if;
  select used into v_used from public.paid_usage where day = (now() at time zone 'utc')::date and svc = p_svc;
  if coalesce(v_used, 0) >= v_max then return 'paid_budget_exhausted'; end if;
  return 'ok';
end $$;
revoke all on function public.paid_check(text) from public, anon, authenticated;
grant execute on function public.paid_check(text) to service_role;
