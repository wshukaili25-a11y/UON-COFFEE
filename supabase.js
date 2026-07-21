const SUPABASE_URL = 'https://irkhvydgxpseflggbeqq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH'

window._sbURL = SUPABASE_URL
window._sbKEY = SUPABASE_ANON_KEY

function createRestClient(url, key) {
  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  }

  function from(table) {
    const state = {
      params: [],
      method: 'GET',
      body: undefined,
      prefer: '',
      single: false,
      count: false
    }

    const api = {
      select(columns = '*', options = {}) {
        state.params.push(`select=${encodeURIComponent(columns)}`)
        if (options.count === 'exact') state.count = true
        return api
      },
      order(column, options = {}) {
        state.params.push(`order=${encodeURIComponent(column)}.${options.ascending === false ? 'desc' : 'asc'}`)
        return api
      },
      limit(value) {
        state.params.push(`limit=${Number(value)}`)
        return api
      },
      eq(column, value) {
        state.params.push(`${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`)
        return api
      },
      neq(column, value) {
        state.params.push(`${encodeURIComponent(column)}=neq.${encodeURIComponent(value)}`)
        return api
      },
      in(column, values) {
        state.params.push(`${encodeURIComponent(column)}=in.(${values.map(v => encodeURIComponent(v)).join(',')})`)
        return api
      },
      single() {
        state.single = true
        state.params.push('limit=1')
        return api
      },
      insert(payload) {
        state.method = 'POST'
        state.body = payload
        state.prefer = 'return=representation'
        return api
      },
      update(payload) {
        state.method = 'PATCH'
        state.body = payload
        state.prefer = 'return=representation'
        return api
      },
      delete() {
        state.method = 'DELETE'
        return api
      },
      upsert(payload) {
        state.method = 'POST'
        state.body = payload
        state.prefer = 'resolution=merge-duplicates,return=representation'
        return api
      },
      async execute() {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)

        try {
          const headers = { ...baseHeaders }
          const prefers = []
          if (state.prefer) prefers.push(state.prefer)
          if (state.count) prefers.push('count=exact')
          if (prefers.length) headers.Prefer = prefers.join(',')

          const query = state.params.length ? `?${state.params.join('&')}` : ''
          const response = await fetch(`${url}/rest/v1/${table}${query}`, {
            method: state.method,
            headers,
            body: state.body === undefined ? undefined : JSON.stringify(state.body),
            signal: controller.signal
          })

          const contentRange = response.headers.get('content-range')
          const count = contentRange ? Number(contentRange.split('/')[1]) || 0 : 0
          let data = null

          if (response.status !== 204) {
            const text = await response.text()
            data = text ? JSON.parse(text) : null
          }

          if (!response.ok) {
            return { data: null, error: data || { message: `HTTP ${response.status}` }, count: 0 }
          }

          if (state.single) {
            const row = Array.isArray(data) ? data[0] : data
            return {
              data: row || null,
              error: row ? null : { message: 'No rows found' },
              count
            }
          }

          return { data, error: null, count }
        } catch (error) {
          return {
            data: null,
            error: {
              message: error?.name === 'AbortError'
                ? 'انتهت مهلة الاتصال بقاعدة البيانات'
                : (error?.message || String(error))
            },
            count: 0
          }
        } finally {
          clearTimeout(timer)
        }
      },
      then(resolve, reject) {
        return api.execute().then(resolve, reject)
      },
      catch(reject) {
        return api.execute().catch(reject)
      }
    }

    return api
  }

  return { from }
}

export const supabase = createRestClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.supabase = supabase

async function safeQuery(label, fn, fallback = []) {
  try {
    const { data, error } = await fn()
    if (error) throw error
    return data ?? fallback
  } catch (error) {
    console.warn(`[UON Hub] ${label} failed:`, error?.message || error)
    return fallback
  }
}

async function safeWrite(label, fn) {
  const { data, error } = await fn()
  if (error) {
    console.error(`[UON Hub] ${label} failed:`, error)
    throw error
  }
  return data
}

export async function getTools() {
  return safeQuery('getTools', () => supabase.from('tools').select('*').order('id'))
}

export async function saveTool(tool) {
  const payload = {
    title: tool.title,
    description: tool.desc || tool.description,
    icon: tool.icon,
    color: tool.color,
    btn_text: tool.btnText || tool.btn_text
  }
  if (tool.id) return safeWrite('saveTool.update', () => supabase.from('tools').update(payload).eq('id', tool.id))
  return safeWrite('saveTool.insert', () => supabase.from('tools').insert(payload))
}

export async function deleteTool(id) {
  return safeWrite('deleteTool', () => supabase.from('tools').delete().eq('id', id))
}

export async function getConfessions() {
  return safeQuery('getConfessions', () => supabase.from('confessions').select('*').order('created_at', { ascending: false }))
}

export async function addConfession(conf) {
  return safeWrite('addConfession', () => supabase.from('confessions').insert({
    id: conf.id,
    text: conf.text,
    category: conf.cat,
    is_anon: conf.anon,
    likes: 0
  }))
}

export async function likeConfession(id, currentLikes) {
  return safeWrite('likeConfession', () => supabase.from('confessions').update({
    likes: Number(currentLikes || 0) + 1
  }).eq('id', id))
}

export async function deleteConfession(id) {
  return safeWrite('deleteConfession', () => supabase.from('confessions').delete().eq('id', id))
}

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
    tags: rest.tags
  }))
}

export async function deleteRestaurant(id) {
  return safeWrite('deleteRestaurant', () => supabase.from('restaurants').delete().eq('id', id))
}

export async function getSetting(key) {
  const data = await safeQuery(
    'getSetting',
    () => supabase.from('settings').select('value').eq('key', key).single(),
    null
  )
  return data?.value || null
}

export async function setSetting(key, value) {
  return safeWrite('setSetting', () => supabase.from('settings').upsert({ key, value }))
}
