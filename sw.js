import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://fjkxahhoacqlpiafmfyd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa3hhaGhvYWNxbHBpYWZtZnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTkwMjQsImV4cCI6MjA5Mzg5NTAyNH0.Ls3gaXRso3BgcDAByoYeQQot_KbAOfREvxyW8u4vkGA'
)

// ═══ TOOLS ═══
export async function getTools() {
  const { data } = await supabase.from('tools').select('*').order('id')
  return data || []
}

export async function saveTool(tool) {
  if (tool.id) {
    await supabase.from('tools').update({
      title: tool.title, description: tool.desc,
      icon: tool.icon, color: tool.color, btn_text: tool.btnText
    }).eq('id', tool.id)
  } else {
    await supabase.from('tools').insert({
      title: tool.title, description: tool.desc,
      icon: tool.icon, color: tool.color, btn_text: tool.btnText
    })
  }
}

export async function deleteTool(id) {
  await supabase.from('tools').delete().eq('id', id)
}

// ═══ CONFESSIONS ═══
export async function getConfessions() {
  const { data } = await supabase.from('confessions')
    .select('*').order('created_at', { ascending: false })
  return data || []
}

export async function addConfession(conf) {
  await supabase.from('confessions').insert({
    id: conf.id, text: conf.text,
    category: conf.cat, is_anon: conf.anon, likes: 0
  })
}

export async function likeConfession(id, currentLikes) {
  await supabase.from('confessions')
    .update({ likes: currentLikes + 1 }).eq('id', id)
}

export async function deleteConfession(id) {
  await supabase.from('confessions').delete().eq('id', id)
}

// ═══ RESTAURANTS ═══
export async function getRestaurants() {
  const { data } = await supabase.from('restaurants')
    .select('*').order('created_at', { ascending: false })
  return data || []
}

export async function addRestaurant(rest) {
  await supabase.from('restaurants').insert({
    id: rest.id, name: rest.name, type: rest.type,
    emoji: rest.emoji, description: rest.desc,
    distance: rest.dist, stars: rest.stars,
    price: rest.price, status: rest.status, tags: rest.tags
  })
}

export async function deleteRestaurant(id) {
  await supabase.from('restaurants').delete().eq('id', id)
}

// ═══ SETTINGS ═══
export async function getSetting(key) {
  const { data } = await supabase.from('settings')
    .select('value').eq('key', key).single()
  return data?.value || null
}

export async function setSetting(key, value) {
  await supabase.from('settings')
    .upsert({ key, value })
}
