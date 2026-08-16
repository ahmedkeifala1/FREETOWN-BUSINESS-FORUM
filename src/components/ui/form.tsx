'use client'

import { useFormStatus } from 'react-dom'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { FieldErrors } from '@/lib/validation'

/**
 * Form primitives (§4.9 "mobile-optimised forms", NFR-09).
 *
 * Accessibility is built into the components rather than left to each form:
 * every field wires its own label, its error via `aria-describedby`, and
 * `aria-invalid`. Error summaries use `role="alert"` so a screen reader
 * announces a failed submission instead of leaving the user wondering why
 * nothing happened.
 *
 * All validation shown here is a repeat of what the server already decided —
 * the browser never has the last word (NFR-05).
 */

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  name: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={name} className="block text-sm font-medium text-ink-900">
        {label}
        {required && (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        )}
        {!required && (
          <span className="ml-1.5 text-xs font-normal text-ink-500">
            (optional)
          </span>
        )}
      </label>

      {hint && (
        <p id={`${name}-hint`} className="text-xs text-ink-600">
          {hint}
        </p>
      )}

      {children}

      {error && (
        <p
          id={`${name}-error`}
          className="flex items-start gap-1.5 text-sm text-red-700"
        >
          <Icon name="close" className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

const CONTROL =
  'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-ink-950 ' +
  'placeholder:text-ink-400 transition ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500'

const CONTROL_OK = 'border-ink-300 focus:border-forest-600'
const CONTROL_BAD = 'border-red-500 focus:border-red-600'

/** Wires aria-invalid and aria-describedby from the presence of an error. */
function controlProps(name: string, error?: string, hint?: string) {
  const describedBy =
    [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') ||
    undefined

  return {
    id: name,
    name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }
}

export function Input({
  name,
  error,
  hint,
  className,
  ...props
}: { name: string; error?: string; hint?: string } & Omit<
  ComponentProps<'input'>,
  'name' | 'id'
>) {
  return (
    <input
      {...controlProps(name, error, hint)}
      className={cn(CONTROL, error ? CONTROL_BAD : CONTROL_OK, className)}
      {...props}
    />
  )
}

export function Textarea({
  name,
  error,
  hint,
  className,
  rows = 5,
  ...props
}: { name: string; error?: string; hint?: string } & Omit<
  ComponentProps<'textarea'>,
  'name' | 'id'
>) {
  return (
    <textarea
      rows={rows}
      {...controlProps(name, error, hint)}
      className={cn(CONTROL, error ? CONTROL_BAD : CONTROL_OK, className)}
      {...props}
    />
  )
}

export function Select({
  name,
  error,
  hint,
  className,
  children,
  ...props
}: { name: string; error?: string; hint?: string } & Omit<
  ComponentProps<'select'>,
  'name' | 'id'
>) {
  return (
    <select
      {...controlProps(name, error, hint)}
      className={cn(
        CONTROL,
        error ? CONTROL_BAD : CONTROL_OK,
        'appearance-none bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2367635d' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
}

/**
 * A radio styled as a selectable card — the pattern used for ticket types and
 * payment methods (§4.9). Large touch target, and the whole card is the label.
 */
export function RadioCard({
  name,
  value,
  title,
  description,
  price,
  defaultChecked,
  disabled,
  children,
}: {
  name: string
  value: string
  title: string
  description?: string
  price?: ReactNode
  defaultChecked?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition',
        'border-ink-200 hover:border-forest-400',
        'has-[:checked]:border-forest-600 has-[:checked]:bg-forest-50 has-[:checked]:ring-1 has-[:checked]:ring-forest-600',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:disabled]:hover:border-ink-200',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 size-4 shrink-0 accent-forest-600"
      />

      <span className="flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display font-semibold text-ink-950">{title}</span>
          {price && <span className="font-semibold text-forest-700">{price}</span>}
        </span>

        {description && (
          <span className="mt-1 block text-sm text-ink-600">{description}</span>
        )}

        {children && <span className="mt-2 block">{children}</span>}
      </span>
    </label>
  )
}

export function Checkbox({
  name,
  label,
  error,
  defaultChecked,
  ...props
}: {
  name: string
  label: ReactNode
  error?: string
} & Omit<ComponentProps<'input'>, 'name' | 'id' | 'type'>) {
  return (
    <div className="space-y-1.5">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-800">
        <input
          type="checkbox"
          id={name}
          name={name}
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-0.5 size-4.5 shrink-0 rounded accent-forest-600"
          {...props}
        />
        <span>{label}</span>
      </label>

      {error && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/** Bot trap. Positioned off-screen rather than `display:none`, which some bots skip. */
export function Honeypot({ name = 'website' }: { name?: string }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor={name}>Leave this field empty</label>
      <input id={name} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  )
}

export function FormMessage({
  status,
  children,
}: {
  status: 'success' | 'error' | 'info'
  children: ReactNode
}) {
  const tones = {
    success: 'border-forest-200 bg-forest-50 text-forest-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-harbour-200 bg-harbour-50 text-harbour-900',
  }

  return (
    <div
      // Errors interrupt; confirmations wait for a pause. Both are announced.
      role={status === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        tones[status],
      )}
    >
      <Icon
        name={status === 'success' ? 'check' : status === 'error' ? 'close' : 'target'}
        className="mt-0.5 size-4 shrink-0"
      />
      <div>{children}</div>
    </div>
  )
}

/** Lists field errors at the top of a long form so nothing is missed below the fold. */
export function ErrorSummary({ errors }: { errors?: FieldErrors }) {
  const entries = Object.entries(errors ?? {})
  if (entries.length === 0) return null

  return (
    <FormMessage status="error">
      <p className="font-medium">
        Please check {entries.length === 1 ? 'this' : `these ${entries.length}`}{' '}
        {entries.length === 1 ? 'field' : 'fields'}:
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`} className="underline underline-offset-2">
              {message}
            </a>
          </li>
        ))}
      </ul>
    </FormMessage>
  )
}

/**
 * Submit button that disables itself while the action is in flight.
 *
 * `useFormStatus` reads the state of the enclosing <form>, so this works
 * without the parent passing anything down — and it prevents the double
 * submission that on a slow connection would otherwise take a delegate's money
 * twice.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Please wait…',
  ...props
}: {
  children: ReactNode
  pendingLabel?: string
} & Omit<ComponentProps<typeof Button>, 'type' | 'children'>) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
