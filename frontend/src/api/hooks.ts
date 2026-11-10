import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  Budget,
  Category,
  Dashboard,
  Debt,
  Goal,
  MonthlyReport,
  Paginated,
  Recurring,
  Transaction,
  Transfer,
  Wallet,
} from './types'

// Anything that changes money invalidates every derived view.
const MONEY_KEYS = ['dashboard', 'report', 'transactions', 'wallets', 'transfers', 'goals', 'budgets', 'debts', 'recurring']

function useInvalidateMoney() {
  const qc = useQueryClient()
  return () => Promise.all(MONEY_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })))
}

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: ['dashboard', month],
    queryFn: async () => (await api.get<Dashboard>('/dashboard/', { params: { month } })).data,
  })
}

export function useMonthlyReport(month: string) {
  return useQuery({
    queryKey: ['report', month],
    queryFn: async () => (await api.get<MonthlyReport>('/reports/monthly/', { params: { month } })).data,
  })
}

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => (await api.get<Wallet[]>('/wallets/')).data,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<Category[]>('/categories/')).data,
    staleTime: 5 * 60_000,
  })
}

export interface TransactionFilters {
  month?: string
  kind?: string
  wallet?: number | ''
  category?: number | ''
  search?: string
}

export function useTransactions(filters: TransactionFilters) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: async () =>
      (await api.get<Paginated<Transaction>>('/transactions/', { params: { ...params, limit: 500 } })).data,
  })
}

export function useTransfers() {
  return useQuery({
    queryKey: ['transfers'],
    queryFn: async () => (await api.get<Paginated<Transfer>>('/transfers/', { params: { limit: 20 } })).data,
  })
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => (await api.get<Budget[]>('/budgets/')).data,
  })
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => (await api.get<Goal[]>('/goals/')).data,
  })
}

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: async () => (await api.get<Debt[]>('/debts/')).data,
  })
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => (await api.get<Recurring[]>('/recurring/')).data,
  })
}

/** Generic create/update/delete for a REST collection. */
export function useCrud<T extends { id: number }>(resource: string, extraKeys: string[] = []) {
  const qc = useQueryClient()
  const invalidateMoney = useInvalidateMoney()
  const invalidate = () =>
    Promise.all([invalidateMoney(), ...extraKeys.map((key) => qc.invalidateQueries({ queryKey: [key] }))])

  const save = useMutation({
    mutationFn: async (body: Partial<T> & { id?: number }) => {
      const { id, ...rest } = body
      const resp = id
        ? await api.patch<T>(`/${resource}/${id}/`, rest)
        : await api.post<T>(`/${resource}/`, rest)
      return resp.data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${resource}/${id}/`)
    },
    onSuccess: invalidate,
  })

  return { save, remove }
}

export function useGoalContribution() {
  const invalidateMoney = useInvalidateMoney()
  return useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: string }) =>
      (await api.post<Goal>(`/goals/${id}/contribute/`, { amount })).data,
    onSuccess: invalidateMoney,
  })
}

export function useDebtPayment() {
  const invalidateMoney = useInvalidateMoney()
  const repay = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; amount: string; date: string; note?: string }) =>
      (await api.post<Debt>(`/debts/${id}/repay/`, body)).data,
    onSuccess: invalidateMoney,
  })
  const undo = useMutation({
    mutationFn: async ({ id, paymentId }: { id: number; paymentId: number }) =>
      (await api.delete<Debt>(`/debts/${id}/payments/${paymentId}/`)).data,
    onSuccess: invalidateMoney,
  })
  return { repay, undo }
}
