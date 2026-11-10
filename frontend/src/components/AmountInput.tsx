import { useState, type CSSProperties } from 'react'

import { formatAmountInput, parseAmountInput } from '../lib/format'

/** Numeric input that groups thousands as you type and reports a plain decimal string. */
export function AmountInput({
  value, onChange, big = false, id, invalid, autoFocus, style, placeholder = '0',
}: {
  value: string
  onChange: (plain: string) => void
  big?: boolean
  id?: string
  invalid?: boolean
  autoFocus?: boolean
  style?: CSSProperties
  placeholder?: string
}) {
  const [display, setDisplay] = useState(() => (value ? formatAmountInput(value) : ''))
  return (
    <input
      id={id}
      className={`input num ${big ? 'amount-input' : ''}`}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={display}
      aria-invalid={invalid}
      data-autofocus={autoFocus ? '' : undefined}
      style={style}
      onChange={(e) => {
        const next = formatAmountInput(e.target.value)
        setDisplay(next)
        onChange(parseAmountInput(next))
      }}
    />
  )
}
