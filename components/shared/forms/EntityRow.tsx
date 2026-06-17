// ============================================================================
// EntityRow — one row in a "must-sum-to-100" list: picker + % input + remove.
//
// Three columns: EntityCombo (autocomplete) | numeric % | × button.
// Used by the New Contract modal AND the property edit form.
// ============================================================================

'use client'

import { EntityCombo } from './EntityCombo'

const INPUT_CLASS =
  'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'

interface Props {
  input:           string
  pickedId:        string | null
  pct:             string
  options:         { id: string; name: string }[]
  entityLabel:     string
  placeholder:     string
  onChange:        (text: string, pickedId: string | null) => void
  onPctChange:     (v: string) => void
  onRequestCreate: (name: string) => void
  /** When undefined the remove button is disabled (last row guard). */
  onRemove?:       () => void
}

export function EntityRow({
  input, pickedId, pct, options, entityLabel, placeholder,
  onChange, onPctChange, onRequestCreate, onRemove,
}: Props) {
  return (
    <div className="grid grid-cols-[1fr_90px_28px] gap-2 items-start">
      <EntityCombo
        value={input}
        pickedId={pickedId}
        onChange={onChange}
        onRequestCreate={onRequestCreate}
        options={options}
        entityLabel={entityLabel}
        placeholder={placeholder}
      />
      <input
        type="number"
        value={pct}
        onChange={e => onPctChange(e.target.value)}
        min={0}
        max={100}
        step="any"
        placeholder="100"
        className={`${INPUT_CLASS} text-right tabular-nums`}
        aria-label="Porcentaje"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!onRemove}
        title={onRemove ? 'Quitar' : 'Tiene que quedar al menos uno'}
        className={`h-9 w-7 text-[18px] leading-none rounded ${
          onRemove ? 'text-gray-400 hover:text-danger transition-colors' : 'text-gray-200 cursor-not-allowed'
        }`}
      >×</button>
    </div>
  )
}
