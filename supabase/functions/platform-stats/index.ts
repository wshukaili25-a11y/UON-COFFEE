import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store, max-age=0'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) throw new Error('Supabase environment variables are missing')

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const [tools, summaries, ratings, groups] = await Promise.all([
      db.from('tools_items').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('summaries').select('id', { count: 'exact', head: true }).eq('approved', true),
      db.from('rating_submissions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('whatsapp_groups').select('id', { count: 'exact', head: true }).eq('approved', true)
    ])

    const errors = [tools.error, summaries.error, ratings.error, groups.error].filter(Boolean)
    if (errors.length) {
      console.error('platform-stats query errors', errors)
      throw new Error(errors.map((e: any) => e?.message || String(e)).join(' | '))
    }

    return json({
      ok: true,
      tools: tools.count ?? 0,
      summaries: summaries.count ?? 0,
      ratings: ratings.count ?? 0,
      groups: groups.count ?? 0,
      generated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('platform-stats failed', error)
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
