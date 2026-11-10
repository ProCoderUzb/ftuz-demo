import {
  ArrowLeftRight, ChartPie, HandCoins, LayoutDashboard, LogOut, Menu, PiggyBank, Plus, Settings, Shapes, Target, TrendingUp, Wallet,
} from 'lucide-react'
import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { useOpenTransaction } from './TransactionModal'
import { Modal, Skeleton } from './ui'

const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard },
  { to: '/transactions', key: 'transactions', icon: ArrowLeftRight },
  { to: '/reports', key: 'reports', icon: ChartPie },
  { to: '/budgets', key: 'budgets', icon: PiggyBank },
  { to: '/goals', key: 'goals', icon: Target },
  { to: '/debts', key: 'debts', icon: HandCoins },
  { to: '/wallets', key: 'wallets', icon: Wallet },
  { to: '/categories', key: 'categories', icon: Shapes },
  { to: '/settings', key: 'settings', icon: Settings },
] as const

export function Brand() {
  const { t } = useTranslation()
  return (
    <Link to="/" className="brand" aria-label="FTuz">
      <span className="brand-mark"><TrendingUp size={20} strokeWidth={2.6} aria-hidden /></span>
      <span>
        FTuz
        <small>{t('app.tagline')}</small>
      </span>
    </Link>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const openTx = useOpenTransaction()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="FTuz">
        <Brand />
        <nav className="stack" style={{ gap: 4 }}>
          {NAV.map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav-link">
              <Icon size={20} aria-hidden />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-link btn-ghost" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}>
            <LogOut size={20} aria-hidden /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <main className="main" key={location.pathname}>
        <div className="topbar-mobile">
          <Brand />
        </div>
        <Suspense fallback={<div className="page"><Skeleton height={44} width="40%" /><Skeleton height={240} /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <button className="fab no-print" onClick={() => openTx()}>
        <Plus size={22} aria-hidden /> {t('nav.add')}
      </button>

      <nav className="bottom-nav no-print" aria-label="FTuz">
        {NAV.slice(0, 2).map(({ to, key, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={22} aria-hidden />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
        <button className="nav-add" onClick={() => openTx()} aria-label={t('nav.add')}>
          <Plus size={28} aria-hidden />
        </button>
        <NavLink to="/reports">
          <ChartPie size={22} aria-hidden />
          {t('nav.reports')}
        </NavLink>
        <button onClick={() => setMoreOpen(true)}>
          <Menu size={22} aria-hidden />
          {t('nav.more')}
        </button>
      </nav>

      {moreOpen && (
        <Modal title={t('nav.more')} onClose={() => setMoreOpen(false)}>
          <nav className="stack" style={{ gap: 4 }}>
            {NAV.slice(3).map(({ to, key, icon: Icon }) => (
              <NavLink key={to} to={to} className="nav-link" onClick={() => setMoreOpen(false)}>
                <Icon size={20} aria-hidden />
                {t(`nav.${key}`)}
              </NavLink>
            ))}
            <button className="nav-link" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}>
              <LogOut size={20} aria-hidden /> {t('nav.logout')}
            </button>
          </nav>
        </Modal>
      )}
    </div>
  )
}
