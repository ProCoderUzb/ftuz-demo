import { ArrowDownRight, ArrowUpRight, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCategories, useCrud } from '../api/hooks'
import type { Category, Kind } from '../api/types'
import { IconColorPicker } from '../components/IconColorPicker'
import {
  CategoryBadge, ConfirmDialog, ErrorState, Field, Modal, PageHead, Segmented, Skeleton, Tile, TileHead, useToast,
} from '../components/ui'
import { categoryName } from '../lib/format'

function CategoryForm({ category, kind, onClose }: { category?: Category; kind: Kind; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save, remove } = useCrud<Category>('categories', ['categories'])
  const [name, setName] = useState(category ? categoryName(category) : '')
  const [type, setType] = useState<Kind>(category?.kind ?? kind)
  const [icon, setIcon] = useState(category?.icon ?? 'circle-ellipsis')
  const [color, setColor] = useState(category?.color ?? '#6366F1')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: t('auth.errors.required') })
    // A renamed default category keeps its key but shows the custom name from now on.
    const renamed = !category?.key || name.trim() !== categoryName(category)
    try {
      await save.mutateAsync({ id: category?.id, kind: type, icon, color, ...(renamed ? { name: name.trim() } : {}) })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={category ? t('categories.editTitle') : t('categories.new')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Segmented<Kind> label={t('common.category')} value={type} onChange={setType}
          options={[
            { value: 'expense', label: t('common.expense'), className: 'seg-expense' },
            { value: 'income', label: t('common.income'), className: 'seg-income' },
          ]} />
        {errors.kind && <em className="field-error">{errors.kind}</em>}
        <Field label={t('common.name')} error={errors.name}>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
        <div className="row-between">
          {category ? <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>{t('common.delete')}</button> : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
          </div>
        </div>
      </form>
      {confirming && category && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('categories.archivedHint')} onClose={() => setConfirming(false)}
          onConfirm={async () => { await remove.mutateAsync(category.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

export function CategoriesPage() {
  const { t } = useTranslation()
  const { data: categories, isLoading, isError, refetch } = useCategories()
  const { save } = useCrud<Category>('categories', ['categories'])
  const [editing, setEditing] = useState<{ category?: Category; kind: Kind } | null>(null)

  const section = (kind: Kind) => {
    const items = categories?.filter((c) => c.kind === kind) ?? []
    return (
      <Tile className="span-2">
        <TileHead
          title={kind === 'income' ? t('common.income') : t('common.expenses')}
          icon={kind === 'income' ? ArrowUpRight : ArrowDownRight}
          action={<button className="btn btn-sm" onClick={() => setEditing({ kind })}><Plus size={16} aria-hidden /> {t('common.add')}</button>}
        />
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((c) => (
            <li key={c.id} className="list-item" style={{ opacity: c.is_archived ? 0.55 : 1 }}>
              <CategoryBadge category={c} size={36} />
              <span className="grow truncate" style={{ fontWeight: 550 }}>
                {categoryName(c)}
                {c.is_archived && <span className="xs muted"> · {t('common.archived')}</span>}
              </span>
              {c.is_archived ? (
                <button className="btn btn-ghost btn-sm" onClick={() => save.mutate({ id: c.id, is_archived: false })}>
                  <RotateCcw size={16} aria-hidden /> {t('categories.restore')}
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')} onClick={() => setEditing({ category: c, kind })}>
                  <Pencil size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Tile>
    )
  }

  return (
    <div className="page">
      <PageHead title={t('categories.title')} subtitle={t('categories.subtitle')} />
      {isLoading && <Tile><Skeleton height={200} /></Tile>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}
      {categories && (
        <div className="bento">
          {section('expense')}
          {section('income')}
        </div>
      )}
      <p className="small muted">{t('categories.archivedHint')}</p>
      {editing && <CategoryForm category={editing.category} kind={editing.kind} onClose={() => setEditing(null)} />}
    </div>
  )
}
