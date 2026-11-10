import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, setSessionExpiredHandler, tokens } from '../api/client'
import type { AuthResponse, Lang, User } from '../api/types'
import { setLanguage } from '../i18n'
import { applyPreferences } from '../lib/preferences'

interface AuthState {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: { name: string; username: string; password: string; language: Lang }) => Promise<void>
  logout: () => void
  updateUser: (patch: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const adopt = useCallback((next: User) => {
    setUser(next)
    setLanguage(next.language)
    applyPreferences(next)
  }, [])

  const logout = useCallback(() => {
    tokens.clear()
    setUser(null)
    qc.clear()
  }, [qc])

  useEffect(() => {
    setSessionExpiredHandler(logout)
    if (!tokens.access) {
      setReady(true)
      return
    }
    api
      .get<User>('/auth/me/')
      .then(({ data }) => adopt(data))
      .catch(() => tokens.clear())
      .finally(() => setReady(true))
  }, [adopt, logout])

  const login = useCallback(
    async (username: string, password: string) => {
      const { data } = await api.post<{ access: string; refresh: string }>('/auth/login/', { username, password })
      tokens.set(data.access, data.refresh)
      const me = await api.get<User>('/auth/me/')
      adopt(me.data)
    },
    [adopt],
  )

  const register = useCallback(
    async (payload: { name: string; username: string; password: string; language: Lang }) => {
      const { data } = await api.post<AuthResponse>('/auth/register/', payload)
      tokens.set(data.access, data.refresh)
      adopt(data.user)
    },
    [adopt],
  )

  const updateUser = useCallback(
    async (patch: Partial<User>) => {
      if (!user) return
      adopt({ ...user, ...patch }) // optimistic: preferences apply instantly
      const { data } = await api.patch<User>('/auth/me/', patch)
      adopt(data)
    },
    [user, adopt],
  )

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateUser }),
    [user, ready, login, register, logout, updateUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
