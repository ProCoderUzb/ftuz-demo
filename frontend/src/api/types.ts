// Money values arrive as decimal strings ("125000.00") to stay exact.
export type Money = string
export type Kind = 'income' | 'expense'
export type Currency = 'UZS' | 'USD'
export type Lang = 'uz' | 'ru' | 'en'
export type ThemePref = 'system' | 'light' | 'dark'
export type TextSize = 's' | 'm' | 'l' | 'xl'

export interface User {
  id: number
  username: string
  name: string
  language: Lang
  theme: ThemePref
  text_size: TextSize
  simple_mode: boolean
  date_joined: string
}

export interface AuthResponse {
  user: User
  access: string
  refresh: string
}

export type WalletType = 'cash' | 'card' | 'bank' | 'savings'

export interface Wallet {
  id: number
  name: string
  type: WalletType
  currency: Currency
  initial_balance: Money
  color: string
  is_archived: boolean
  balance: Money
}

export interface Category {
  id: number
  key: string
  name: string
  kind: Kind
  icon: string
  color: string
  is_archived: boolean
}

export type CategoryRef = Pick<Category, 'id' | 'key' | 'name' | 'icon' | 'color'>

export interface Transaction {
  id: number
  kind: Kind
  wallet: number
  category: number
  amount: Money
  currency: Currency
  date: string
  note: string
  recurring: number | null
  created_at: string
}

export interface Transfer {
  id: number
  from_wallet: number
  to_wallet: number
  amount: Money
  to_amount: Money
  date: string
  note: string
}

export interface Budget {
  id: number
  category: number
  amount: Money
}

export interface Goal {
  id: number
  name: string
  icon: string
  color: string
  currency: Currency
  target_amount: Money
  saved_amount: Money
  deadline: string | null
  is_completed: boolean
}

export type DebtDirection = 'lent' | 'borrowed'

export interface DebtPayment {
  id: number
  amount: Money
  date: string
  note: string
}

export interface Debt {
  id: number
  person: string
  direction: DebtDirection
  amount: Money
  currency: Currency
  date: string
  due_date: string | null
  note: string
  is_settled: boolean
  paid: Money
  remaining: Money
  payments: DebtPayment[]
}

export type Frequency = 'monthly' | 'weekly'

export interface Recurring {
  id: number
  kind: Kind
  wallet: number
  category: number
  amount: Money
  currency: Currency
  note: string
  frequency: Frequency
  day_of_month: number | null
  /** 0 = Monday ... 6 = Sunday */
  weekday: number | null
  start_date: string
  last_run_date: string | null
  next_date: string | null
  is_active: boolean
}

export interface DebtSummary {
  owed_to_me: Money
  i_owe: Money
  owed_to_me_count: number
  i_owe_count: number
  next_due: Debt | null
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Tip {
  code: string
  level: 'danger' | 'warning' | 'info' | 'success'
  params: Record<string, unknown>
}

export interface CategoryBreakdown {
  category: CategoryRef
  kind: Kind
  amount: Money
  count: number
  share: number
  previous: Money
  change: number | null
}

export interface BudgetProgress {
  id: number
  category: CategoryRef
  limit: Money
  spent: Money
  left: Money
  percent: number
}

export interface MonthSummary {
  month: string
  income: Money
  expense: Money
  net: Money
  savings_rate: number | null
  previous: { income: Money; expense: Money; net: Money }
  change: { income: number | null; expense: number | null }
  categories: CategoryBreakdown[]
  daily: { day: number; income: Money; expense: Money }[]
  budgets: BudgetProgress[]
  days_in_month: number
}

export interface Dashboard {
  usd_rate: Money
  total_balance: Money
  wallets: Wallet[]
  summary: MonthSummary
  recent: Transaction[]
  goals: Goal[]
  debts: DebtSummary
  tips: Tip[]
}

export interface MonthlyReport extends MonthSummary {
  usd_rate: Money
  trend: { month: string; income: Money; expense: Money }[]
  top_expenses: { id: number; date: string; amount: Money; currency: Currency; note: string; category: CategoryRef }[]
  tips: Tip[]
}
