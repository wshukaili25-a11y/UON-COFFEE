-- The raw analytics dashboard includes private operational/moderation counts and
-- is consumed only by trusted backend paths. Do not expose it through anon/auth RPC.

revoke all on function public.uon_analytics_dashboard(integer) from public, anon, authenticated;
grant execute on function public.uon_analytics_dashboard(integer) to service_role;
