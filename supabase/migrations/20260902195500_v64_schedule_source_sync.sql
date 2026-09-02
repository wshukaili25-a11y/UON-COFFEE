-- UON Hub V64 — secure automatic source refresh

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'uon_ai_sync_v64') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'uon_ai_sync_v64',
      'Internal token for UON AI V64 source sync cron',
      NULL
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.uon_ai_sync_token_valid(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'uon_ai_sync_v64'
      AND decrypted_secret = p_token
  ), false);
$$;

REVOKE ALL ON FUNCTION public.uon_ai_sync_token_valid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.uon_ai_sync_token_valid(text) FROM anon;
REVOKE ALL ON FUNCTION public.uon_ai_sync_token_valid(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.uon_ai_sync_token_valid(text) TO service_role;

DO $$
DECLARE
  old_job bigint;
BEGIN
  SELECT jobid INTO old_job FROM cron.job WHERE jobname = 'uon-ai-source-sync-v64' LIMIT 1;
  IF old_job IS NOT NULL THEN
    PERFORM cron.unschedule(old_job);
  END IF;
END $$;

SELECT cron.schedule(
  'uon-ai-source-sync-v64',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-source-sync-v64',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'uon_ai_sync_v64'
        LIMIT 1
      )
    ),
    body := '{"action":"sync-due","limit":8}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
