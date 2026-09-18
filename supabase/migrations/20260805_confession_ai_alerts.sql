alter table public.ai_supervisor_reviews
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_category text,
  add column if not exists alert_message_id text;

create index if not exists ai_supervisor_reviews_confession_alert_idx
  on public.ai_supervisor_reviews(source_table, alert_sent_at desc)
  where source_table='confessions';

create or replace function public.uon_trigger_confession_ai_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/confession-ai-alert',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('confession_id', new.id::text)
  );
  return new;
exception when others then
  -- Never block confession publishing if moderation service is unavailable.
  return new;
end;
$$;

drop trigger if exists trg_confession_ai_alert on public.confessions;
create trigger trg_confession_ai_alert
after insert on public.confessions
for each row execute function public.uon_trigger_confession_ai_alert();