-- UON Hub V64.4 — proactive Gemini model health probe

CREATE OR REPLACE FUNCTION public.uon_ai_trigger_gemini_probe()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, net, pg_temp
AS $$
  SELECT net.http_post(
    url := 'https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-gemini-probe-v64',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'uon_ai_sync_v64'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$;

REVOKE ALL ON FUNCTION public.uon_ai_trigger_gemini_probe() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.uon_ai_trigger_gemini_probe() FROM anon;
REVOKE ALL ON FUNCTION public.uon_ai_trigger_gemini_probe() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.uon_ai_trigger_gemini_probe() TO service_role;

DO $$
DECLARE
  old_job bigint;
BEGIN
  SELECT jobid INTO old_job
  FROM cron.job
  WHERE jobname = 'uon-ai-gemini-probe-v644'
  LIMIT 1;

  IF old_job IS NOT NULL THEN
    PERFORM cron.unschedule(old_job);
  END IF;
END $$;

SELECT cron.schedule(
  'uon-ai-gemini-probe-v644',
  '17 */4 * * *',
  $cron$
  SELECT public.uon_ai_trigger_gemini_probe();
  $cron$
);
