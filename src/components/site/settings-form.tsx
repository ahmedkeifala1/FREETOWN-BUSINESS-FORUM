'use client'

import { useActionState } from 'react'

import {
  Field,
  FormMessage,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { updateSettings } from '@/lib/actions/admin-settings'
import { idleState } from '@/lib/actions/types'

/**
 * Site settings (§15 "content changes need no redeploy").
 *
 * One form for every group, submitted whole. The action compares each value
 * against the row and only writes the ones that actually differ, so saving a
 * page after changing one field does not stamp thirty rows with a new
 * timestamp and thirty lines into the audit log.
 *
 * The control drawn for each row follows its declared type, which is what makes
 * this generic: a new setting is a new row in the database, not a new field in
 * this file.
 */

export type SettingRow = {
  key: string
  value: string
  label: string
  type: string
  group: string
}

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const [state, formAction] = useActionState(updateSettings, idleState)

  const groups = new Map<string, SettingRow[]>()
  for (const row of settings) {
    const list = groups.get(row.group) ?? []
    list.push(row)
    groups.set(row.group, list)
  }

  return (
    <form action={formAction} className="space-y-10">
      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {[...groups.entries()].map(([group, rows]) => (
        <fieldset key={group} className="space-y-5">
          <legend className="font-display text-lg font-semibold capitalize text-ink-950">
            {group}
          </legend>

          {rows.map((row) => (
            <Field key={row.key} label={row.label} name={row.key} required>
              {row.type === 'TEXTAREA' ? (
                <Textarea name={row.key} rows={4} defaultValue={row.value} />
              ) : row.type === 'BOOLEAN' ? (
                <select
                  id={row.key}
                  name={row.key}
                  defaultValue={row.value}
                  className="block w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-base text-ink-950 focus:border-forest-600"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <Input
                  name={row.key}
                  type={
                    row.type === 'NUMBER'
                      ? 'number'
                      : row.type === 'URL'
                        ? 'url'
                        : row.type === 'EMAIL'
                          ? 'email'
                          : 'text'
                  }
                  defaultValue={row.value}
                />
              )}
            </Field>
          ))}
        </fieldset>
      ))}

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton size="md" pendingLabel="Saving…">
          Save settings
        </SubmitButton>
        <p className="mt-2 text-sm text-ink-600">
          Changes are live immediately — no redeploy needed.
        </p>
      </div>
    </form>
  )
}
