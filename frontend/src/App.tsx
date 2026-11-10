import { lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { TransactionModalProvider } from './components/TransactionModal'
import { LoginPage, RegisterPage } from './pages/AuthPages'

// Pages load on demand; charts (the heaviest dependency) only arrive with the pages that use them.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }))

const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const TransactionsPage = page(() => import('./pages/TransactionsPage'), 'TransactionsPage')
const ReportsPage = page(() => import('./pages/ReportsPage'), 'ReportsPage')
const BudgetsPage = page(() => import('./pages/BudgetsPage'), 'BudgetsPage')
const GoalsPage = page(() => import('./pages/GoalsPage'), 'GoalsPage')
const DebtsPage = page(() => import('./pages/DebtsPage'), 'DebtsPage')
const WalletsPage = page(() => import('./pages/WalletsPage'), 'WalletsPage')
const CategoriesPage = page(() => import('./pages/CategoriesPage'), 'CategoriesPage')
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage')

export default function App() {
  const { user, ready } = useAuth()
  if (!ready) return null

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <TransactionModalProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TransactionModalProvider>
  )
}
