import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const ACCESS = 'ftuz.access'
const REFRESH = 'ftuz.refresh'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const tokens = {
  get access() {
    return read(ACCESS)
  },
  get refresh() {
    return read(REFRESH)
  },
  set(access: string, refresh?: string) {
    try {
      localStorage.setItem(ACCESS, access)
      if (refresh) localStorage.setItem(REFRESH, refresh)
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS)
      localStorage.removeItem(REFRESH)
    } catch {
      /* ignore */
    }
  },
}

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' })

api.interceptors.request.use((config) => {
  const access = tokens.access
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

let onSessionExpired: () => void = () => {}
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

// One shared refresh request, so parallel 401s don't each rotate the refresh token.
let refreshing: Promise<string> | null = null

async function refreshAccess(): Promise<string> {
  const refresh = tokens.refresh
  if (!refresh) throw new Error('no refresh token')
  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
  tokens.set(data.access, data.refresh)
  return data.access
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
  const isAuthCall = original?.url?.startsWith('/auth/login') || original?.url?.startsWith('/auth/register')
  if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
    throw error
  }
  original._retried = true
  try {
    refreshing ??= refreshAccess().finally(() => {
      refreshing = null
    })
    const access = await refreshing
    original.headers.Authorization = `Bearer ${access}`
    return api(original)
  } catch {
    tokens.clear()
    onSessionExpired()
    throw error
  }
})

/** Flatten a DRF error body into {field: firstMessage}. */
export function fieldErrors(error: unknown): Record<string, string> {
  const data = (error as AxiosError)?.response?.data
  if (!data || typeof data !== 'object') return { _: 'network' }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? String(value[0]) : String(value)
  }
  return out
}
