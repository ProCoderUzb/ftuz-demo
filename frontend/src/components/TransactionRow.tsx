import { Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Category, Transaction, Wallet } from '../api/types'
import { categoryName } from '../lib/format'
import { useOpenTransaction } from './TransactionModal'
import { Amount, CategoryBadge } from './ui'

export function TransactionRow({
  tx, categories, wallets, subtitle,
}: { tx: Transaction; categories: Map<number, Category>; wallets: Map<number, Wallet>; subtitle?: string }) {
  const { t } = useTranslation()
  const openTx = useOpenTransaction()
  const category = categories.get(tx.category)
  const wallet = wallets.get(tx.wallet)
  return (
    <li>
      <button
        type="button"
        className="list-item clickable"
        style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', borderBottom: '1px solid var(--hairline)' }}
        onClick={() => openTx({ transaction: tx })}
      >
        {category && <CategoryBadge category={category} />}
        <span className="grow">
          <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{tx.note || categoryName(category)}</span>
          <span className="xs muted truncate" style={{ display: 'block' }}>
            {tx.note ? categoryName(category) : ''}
            {tx.note && (wallet || subtitle) ? ' · ' : ''}
            {subtitle ?? wallet?.name}
            {tx.recurring && (
              <> · <Repeat size={11} aria-label={t('tx.repeating')} style={{ verticalAlign: '-1px' }} /></>
            )}
          </span>
        </span>
        <Amount value={tx.amount} currency={tx.currency} kind={tx.kind} arrow />
      </button>
    </li>
  )
}

export function buildLookups(categories: Category[] = [], wallets: Wallet[] = []) {
  return {
    categoryMap: new Map(categories.map((c) => [c.id, c])),
    walletMap: new Map(wallets.map((w) => [w.id, w])),
  }
}
