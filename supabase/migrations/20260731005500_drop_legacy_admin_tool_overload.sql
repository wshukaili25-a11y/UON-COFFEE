begin;

-- tools_items.id is text in V30. Keeping the legacy bigint overload makes
-- PostgREST unable to resolve uon_admin_set_tool calls from the admin panel.
drop function if exists public.uon_admin_set_tool(text, bigint, text);

commit;
