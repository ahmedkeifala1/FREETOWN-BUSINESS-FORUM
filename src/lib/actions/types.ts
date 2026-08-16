import type { FieldErrors } from '@/lib/validation'

/**
 * The shape every Server Action returns to `useActionState`.
 *
 * One shape for all forms means one `<FormError>` component and one way to
 * render field errors, rather than each form inventing its own contract.
 *
 * `idle` is the initial state. Distinguishing it from `error` with no errors
 * matters: it is what stops a freshly rendered form from announcing a problem
 * that has not happened yet.
 */
export type FormState =
  | { status: 'idle' }
  | { status: 'success'; message: string; data?: Record<string, string> }
  | { status: 'error'; message?: string; errors?: FieldErrors }

export const idleState: FormState = { status: 'idle' }

export function errorState(
  message: string,
  errors?: FieldErrors,
): FormState {
  return { status: 'error', message, errors }
}

export function fieldErrors(errors: FieldErrors): FormState {
  return { status: 'error', errors }
}

export function successState(
  message: string,
  data?: Record<string, string>,
): FormState {
  return { status: 'success', message, data }
}
