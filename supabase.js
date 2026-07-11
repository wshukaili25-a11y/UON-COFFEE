import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://fjkxahhoacqlpiafmfyd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa3hhaGhvYWNxbHBpYWZtZnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTkwMjQsImV4cCI6MjA5Mzg5NTAyNH0.Ls3gaXRso3BgcDAByoYeQQot_KbAOfREvxyW8u4vkGA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { headers: { 'X-Client-Info': 'uon-coffee-web-v2' } }
})

// إتاحة العميل للصفحات القديمة والملفات المشتركة
window.supabase = supabase
window._sbURL = SUPABASE_URL
window._sbKEY = SUPABASE_ANON_KEY

async function safeQuery(label, fn, fallback = []) {
  try {
    const { data, error } = await fn()
    if (error) throw error
    return data ?? fallback
  } catch (error) {
    console.warn(`[UoN Coffee] ${label} failed:`, error?.message || error)
    return fallback
  }
}

async function safeWrite(label, fn) {
  const { data, error } = await fn()
  if (error) {
    console.error(`[UoN Coffee] ${label} failed:`, error)
    throw error
  }
  return data
}

// ═══ TOOLS ═══
export async function getTools() {
  return safeQuery('getTools', () => supabase.from('tools').select('*').order('id'))
}

export async function saveTool(tool) {
  const payload = {
    title: tool.title,
    description: tool.desc || tool.description,
    icon: tool.icon,
    color: tool.color,
    btn_text: tool.btnText || tool.btn_text,
  }
  if (tool.id) return safeWrite('saveTool.update', () => supabase.from('tools').update(payload).eq('id', tool.id))
  return safeWrite('saveTool.insert', () => supabase.from('tools').insert(payload))
}

export async function deleteTool(id) {
  return safeWrite('deleteTool', () => supabase.from('tools').delete().eq('id', id))
}

// ═══ CONFESSIONS / ANNOUNCEMENTS ═══
export async function getConfessions() {
  return safeQuery('getConfessions', () => supabase.from('confessions').select('*').order('created_at', { ascending: false }))
}

export async function addConfession(conf) {
  return safeWrite('addConfession', () => supabase.from('confessions').insert({
    id: conf.id,
    text: conf.text,
    category: conf.cat,
    is_anon: conf.anon,
    likes: 0,
  }))
}

export async function likeConfession(id, currentLikes) {
  return safeWrite('likeConfession', () => supabase.from('confessions').update({ likes: Number(currentLikes || 0) + 1 }).eq('id', id))
}

export async function deleteConfession(id) {
  return safeWrite('deleteConfession', () => supabase.from('confessions').delete().eq('id', id))
}

// ═══ RESTAURANTS ═══
export async function getRestaurants() {
  return safeQuery('getRestaurants', () => supabase.from('restaurants').select('*').order('created_at', { ascending: false }))
}

export async function addRestaurant(rest) {
  return safeWrite('addRestaurant', () => supabase.from('restaurants').insert({
    id: rest.id,
    name: rest.name,
    type: rest.type,
    emoji: rest.emoji,
    description: rest.desc,
    distance: rest.dist,
    stars: rest.stars,
    price: rest.price,
    status: rest.status,
    tags: rest.tags,
  }))
}

export async function deleteRestaurant(id) {
  return safeWrite('deleteRestaurant', () => supabase.from('restaurants').delete().eq('id', id))
}

// ═══ SETTINGS ═══
export async function getSetting(key) {
  const data = await safeQuery('getSetting', () => supabase.from('settings').select('value').eq('key', key).single(), null)
  return data?.value || null
}

export async function setSetting(key, value) {
  return safeWrite('setSetting', () => supabase.from('settings').upsert({ key, value }))
}
