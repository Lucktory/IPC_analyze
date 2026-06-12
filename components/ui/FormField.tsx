// ============================================================================
// FormField — labeled <input> or <textarea>, optionally spanning two columns.
// Used inside `grid grid-cols-1 sm:grid-cols-2` form layouts. Replaces the
// local `Field` mini-components that were duplicated in every Edit*Form.
// ============================================================================

interface FormFieldProps {
  name:         string
  /** Empty string renders an unlabeled field (useful when a section heading already covers it). */
  label:        string
  defaultValue: string | number | null | undefined
  required?:    boolean
  placeholder?: string
  /** input type. Ignored when `textarea` is true. */
  type?:        string
  step?:        string
  max?:         string
  maxLength?:   number
  /** When true, the field spans both columns of the parent grid. */
  wide?:        boolean
  /** Render as a <textarea> instead of <input>. */
  textarea?:    boolean
  rows?:        number
}

export function FormField({
  name,
  label,
  defaultValue,
  required,
  placeholder,
  type      = 'text',
  step,
  max,
  maxLength,
  wide,
  textarea,
  rows      = 3,
}: FormFieldProps) {
  // Numeric fields look right with tabular-nums (so the digits line up
  // when editing); text fields don't need it.
  const numeric  = textarea ? false : (type === 'number' || name === 'cbu' || name === 'account_number' || name === 'dni_or_cuit' || name === 'dni')
  const inputCls = `px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors${numeric ? ' tabular-nums' : ''}`

  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      {label && (
        <span className="label-cap">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue ?? ''}
          required={required}
          placeholder={placeholder}
          rows={rows}
          className={`py-2 resize-y ${inputCls}`}
        />
      ) : (
        <input
          name={name}
          type={type}
          step={step}
          max={max}
          maxLength={maxLength}
          defaultValue={defaultValue ?? ''}
          required={required}
          placeholder={placeholder}
          className={`h-10 ${inputCls}`}
        />
      )}
    </label>
  )
}
