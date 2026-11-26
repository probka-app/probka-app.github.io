-- Відкат шлюзу: повертає job_create без шлюзу, прибирає paid_reserve і paid_usage. Застосовувати лише разом із
-- безпечними заглушками Edge Functions (supabase/functions/_safe-stub), інакше функції не зможуть резервувати бюджет і відмовлятимуть.
create or replace function public.job_create(p_kind text, p_input jsonb)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_uid uuid := auth.uid(); v_id uuid; v_active int; v_done int; v_tier text; v_owner boolean;
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
  insert into public.media_jobs(user_id, kind, input) values (v_uid, p_kind, coalesce(p_input,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $function$;
drop function if exists public.paid_check(text);
drop function if exists public.paid_reserve(text);
drop table if exists public.paid_usage;
