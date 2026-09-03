'use client'

import { useActionState, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { Icon } from '@/components/ui/icon'
import { UploadField } from '@/components/ui/upload'
import { savePage } from '@/lib/actions/admin-pages'
import { idleState } from '@/lib/actions/types'
import type { CmsBlock, CmsListField } from '@/lib/cms-pages'
import { ContentStatus } from '@/lib/enums'

/**
 * Editing one CMS page (§15).
 *
 * The blocks are given by the manifest in `lib/cms-pages`, which the server
 * reads again on save — this form renders what it is handed and cannot add to
 * it. Prose blocks are textareas for the same reason articles are (see
 * `article-form`): the copy is paragraphs, and a rich-text field is how pasted
 * Word markup gets into a database.
 *
 * The repeating blocks — what membership opens, the joining steps, the FAQ —
 * are the only stateful part. Their rows are added and removed in the browser,
 * so their number is not known when the form renders and they cannot be plain
 * named inputs. Each is held in React state and posted as one JSON string in a
 * hidden field, which is the shape the route already parses on the way out
 * (`parseJsonColumn`), so nothing new is invented for the round trip.
 *
 * Every block is optional. A page's route falls back to copy in its own source
 * when a block is missing, so leaving one blank is a real editorial choice —
 * "we have nothing to say about accessibility yet" — rather than an unfinished
 * form, and the server omits blanks instead of storing empty strings.
 */

export type PageFormDefaults = {
  title: string
  metaTitle: string | null
  metaDescription: string | null
  status: string
  /** True when no row exists yet — this save will create the page. */
  isNew: boolean
  /** Raw block values as stored; `list` blocks arrive as their JSON string. */
  blocks: Record<string, string>
}

export function PageForm({
  slug,
  blocks,
  defaults,
  canPublish,
  uploadsEnabled,
}: {
  slug: string
  blocks: CmsBlock[]
  defaults: PageFormDefaults
  canPublish: boolean
  /** Whether a blob store is attached — see lib/uploads. Decided on the server. */
  uploadsEnabled: boolean
}) {
  const [state, formAction] = useActionState(savePage, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="pageSlug" value={slug} />

      <ErrorSummary errors={errors} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/*
        Shown until this page has a row of its own. Every section on it is
        blank, and every blank section keeps the wording already on the site —
        so the thing worth saying is not "this is empty" but "what you write
        here replaces what is there now".
      */}
      {defaults.isNew && (
        <FormMessage status="info">
          Nobody has edited this page yet, so every section below is blank and
          the site is showing the wording built into it. Fill in only the
          sections you want to change
          {canPublish
            ? ', leave the rest blank, and save with the status set to Published.'
            : '. Your role can save a draft; an editor with publishing rights puts it live.'}
        </FormMessage>
      )}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          The page
        </legend>

        <Field label="Title" name="title" error={errors?.title} required>
          <Input
            name="title"
            defaultValue={defaults.title}
            required
            error={errors?.title}
          />
        </Field>
      </fieldset>

      {/* ── The copy ─────────────────────────────────────────────────────── */}

      <fieldset className="space-y-6">
        <legend className="font-display text-base font-semibold text-ink-950">
          Copy
        </legend>
        <p className="text-sm text-ink-600">
          Leave a section blank to keep the wording built into the page. Separate
          paragraphs with a blank line.
        </p>

        {blocks.map((block) => {
          const shared = {
            key: block.key,
            defaultValue: defaults.blocks[block.key] ?? '',
            error: errors?.[`block:${block.key}`],
          }

          switch (block.kind) {
            case 'prose':
              return <ProseBlock {...shared} block={block} />
            case 'line':
              return <LineBlock {...shared} block={block} />
            case 'image':
              return (
                <ImageBlock
                  {...shared}
                  block={block}
                  uploadsEnabled={uploadsEnabled}
                />
              )
            default:
              return <ListBlock {...shared} block={block} />
          }
        })}
      </fieldset>

      {/* ── Search engines ───────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          Search engines
        </legend>
        <p className="text-sm text-ink-600">
          Leave both blank to use the page title.
        </p>

        <Field label="Meta title" name="metaTitle" error={errors?.metaTitle}>
          <Input
            name="metaTitle"
            maxLength={200}
            defaultValue={defaults.metaTitle ?? ''}
            error={errors?.metaTitle}
          />
        </Field>

        <Field
          label="Meta description"
          name="metaDescription"
          error={errors?.metaDescription}
        >
          <Textarea
            name="metaDescription"
            rows={2}
            maxLength={300}
            defaultValue={defaults.metaDescription ?? ''}
            error={errors?.metaDescription}
          />
        </Field>
      </fieldset>

      {/* ── Status ───────────────────────────────────────────────────────── */}

      <div className="space-y-5 border-t border-ink-200 pt-6">
        <Field label="Status" name="status" error={errors?.status} required>
          <Select
            name="status"
            defaultValue={defaults.status}
            error={errors?.status}
          >
            <option value={ContentStatus.DRAFT}>Draft — not public</option>
            <option value={ContentStatus.PUBLISHED}>Published — live</option>
            <option value={ContentStatus.ARCHIVED}>Archived — taken down</option>
          </Select>
        </Field>

        <p className="text-sm text-ink-600">
          A page that is not published shows the wording built into its route
          instead. Legal pages are the exception: unpublishing one returns a
          &ldquo;not found&rdquo; page rather than fallback terms.
        </p>

        {!canPublish && (
          <p className="text-sm text-ink-600">
            Your role can write and edit but not publish. Save it as a draft and
            ask an editor with publishing rights to put it live.
          </p>
        )}

        <SubmitButton size="md" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </form>
  )
}

function ProseBlock({
  block,
  defaultValue,
  error,
}: {
  block: Extract<CmsBlock, { kind: 'prose' }>
  defaultValue: string
  error?: string
}) {
  return (
    <Field
      label={block.label}
      name={`block:${block.key}`}
      hint={block.hint}
      error={error}
    >
      <Textarea
        name={`block:${block.key}`}
        rows={block.rows ?? 4}
        defaultValue={defaultValue}
        error={error}
      />
    </Field>
  )
}

/**
 * A heading, an eyebrow or a button label — one line, one input.
 *
 * The control is the documentation here: a single-line box is what tells an
 * editor that this slot is a heading and not somewhere to write a paragraph.
 * The server enforces the same limit, because the browser never has the last
 * word (NFR-05).
 */
function LineBlock({
  block,
  defaultValue,
  error,
}: {
  block: Extract<CmsBlock, { kind: 'line' }>
  defaultValue: string
  error?: string
}) {
  return (
    <Field
      label={block.label}
      name={`block:${block.key}`}
      hint={block.hint}
      error={error}
    >
      <Input
        name={`block:${block.key}`}
        maxLength={block.max ?? 200}
        defaultValue={defaultValue}
        error={error}
      />
    </Field>
  )
}

/**
 * A picture on a public page.
 *
 * The value stored is an address, as everywhere else on this site, so a
 * photograph already in the media library can simply be pointed at. Where a
 * blob store is attached the same field also takes an upload — which is the
 * whole point of putting images in the page editor rather than leaving them to
 * a developer.
 */
function ImageBlock({
  block,
  defaultValue,
  error,
  uploadsEnabled,
}: {
  block: Extract<CmsBlock, { kind: 'image' }>
  defaultValue: string
  error?: string
  uploadsEnabled: boolean
}) {
  return (
    <Field
      label={block.label}
      name={`block:${block.key}`}
      hint={block.hint}
      error={error}
    >
      <UploadField
        name={`block:${block.key}`}
        kind="image"
        enabled={uploadsEnabled}
        defaultValue={defaultValue}
        placeholder="/brand/hero/one.jpg"
        error={error}
      />
    </Field>
  )
}

/**
 * A repeating block, one card per item.
 *
 * The rows carry a `key` of their own rather than being keyed by index:
 * removing the second of three items would otherwise renumber the third onto
 * the second's React key, and the browser would keep the removed row's text in
 * place while the state underneath said otherwise.
 */
type Row = { key: string; values: Record<string, string> }

function ListBlock({
  block,
  defaultValue,
  error,
}: {
  block: Extract<CmsBlock, { kind: 'list' }>
  defaultValue: string
  error?: string
}) {
  const idPrefix = useId()
  const [rows, setRows] = useState<Row[]>(() =>
    parseRows(defaultValue, block.fields, idPrefix),
  )
  const [nextKey, setNextKey] = useState(0)

  function update(rowKey: string, field: string, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey
          ? { ...row, values: { ...row.values, [field]: value } }
          : row,
      ),
    )
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by
    if (target < 0 || target >= rows.length) return
    setRows((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink-900">{block.label}</p>
        {block.hint && (
          <p className="mt-1 text-sm text-ink-600">{block.hint}</p>
        )}
        {error && (
          <p className="mt-1 text-sm font-medium text-red-700">{error}</p>
        )}
      </div>

      {/* What the server actually reads — see the note at the top. */}
      <input
        type="hidden"
        name={`block:${block.key}`}
        value={JSON.stringify(rows.map((row) => row.values))}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-4 py-6 text-center text-sm text-ink-600">
          Nothing here yet. The page will use the wording built into it.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="rounded-lg border border-ink-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  {block.itemNoun} {index + 1}
                </p>

                <div className="flex items-center gap-1">
                  <RowButton
                    label={`Move ${block.itemNoun} ${index + 1} up`}
                    icon="arrowUp"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <RowButton
                    label={`Move ${block.itemNoun} ${index + 1} down`}
                    icon="arrowDown"
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <RowButton
                    label={`Remove ${block.itemNoun} ${index + 1}`}
                    icon="close"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((entry) => entry.key !== row.key),
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                {block.fields.map((field) => {
                  const id = `${idPrefix}-${row.key}-${field.name}`
                  return (
                    <div key={field.name} className="space-y-1.5">
                      <label
                        htmlFor={id}
                        className="block text-sm font-medium text-ink-900"
                      >
                        {field.label}
                      </label>

                      {/* Deliberately nameless: a control with an empty name
                          is not submitted, so these stay out of the form data
                          and the hidden JSON above is the single source of what
                          gets saved. Two copies of the same text in the payload
                          is how they end up disagreeing. */}
                      {field.kind === 'prose' ? (
                        <Textarea
                          id={id}
                          name=""
                          rows={3}
                          value={row.values[field.name] ?? ''}
                          onChange={(event) =>
                            update(row.key, field.name, event.target.value)
                          }
                        />
                      ) : (
                        <Input
                          id={id}
                          name=""
                          value={row.values[field.name] ?? ''}
                          onChange={(event) =>
                            update(row.key, field.name, event.target.value)
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setRows((current) => [
            ...current,
            {
              key: `${idPrefix}-new-${nextKey}`,
              values: Object.fromEntries(
                block.fields.map((field) => [field.name, '']),
              ),
            },
          ])
          setNextKey((value) => value + 1)
        }}
      >
        <Icon name="plus" className="size-4" />
        Add a {block.itemNoun}
      </Button>
    </div>
  )
}

function RowButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: 'arrowUp' | 'arrowDown' | 'close'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950 disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon name={icon} className="size-4" />
    </button>
  )
}

/**
 * Read the stored JSON back into rows.
 *
 * Anything unreadable becomes no rows rather than throwing: this runs while the
 * editor is being rendered, and a body that a hand-edit or an older shape left
 * malformed should still open — with the block empty and obviously so — rather
 * than take the whole screen down with it.
 */
function parseRows(
  raw: string,
  fields: CmsListField[],
  idPrefix: string,
): Row[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const source = entry as Record<string, unknown>

    return [
      {
        key: `${idPrefix}-stored-${index}`,
        values: Object.fromEntries(
          fields.map((field) => [
            field.name,
            typeof source[field.name] === 'string'
              ? (source[field.name] as string)
              : '',
          ]),
        ),
      },
    ]
  })
}
