'use client'

import { upload } from '@vercel/blob/client'
import { useId, useRef, useState } from 'react'

import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/form'
import { cn } from '@/lib/cn'

/**
 * An address field that can also be filled by choosing a file (§4.14).
 *
 * Every image, film and document on this site is stored as an *address*, and
 * that has not changed — this control still posts one string under one name,
 * and every action reading it is untouched. What it adds is a second way to
 * arrive at that string: pick a file, watch it upload, and the address appears
 * in the field.
 *
 * The upload goes from this browser straight to the store, never through the
 * app's own server; `lib/uploads` explains why, and `/api/uploads` is the route
 * that authorises it. Progress is shown because these are photographs and films
 * over a Freetown connection (NFR-01), and a button that looks inert for ninety
 * seconds gets pressed again.
 *
 * **The text field remains editable at all times.** A file already on the
 * platform that holds it — a film on YouTube, a document on a ministry's site —
 * is addressed, not uploaded, and that is the majority of what the downloads
 * and recordings pages carry. Hiding the field behind an upload button would
 * make those unreachable.
 *
 * When no store is attached (`enabled` false, decided on the server so a stale
 * tab cannot claim otherwise) the file picker is not rendered at all. An
 * upload button that fails on press is worse than no upload button: the person
 * pressing it has no way to tell a missing store from a broken file.
 */

export type UploadKindName = 'image' | 'video' | 'document' | 'audio'

/**
 * What the file picker filters on. Mirrors the server's allow-list in
 * `lib/uploads` — this copy is a convenience for the picker, and the token
 * route checks the real one, because `accept` is advisory.
 */
const ACCEPT: Record<UploadKindName, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml',
  video: 'video/mp4,video/webm,video/quicktime',
  document:
    'application/pdf,application/msword,.docx,.xls,.xlsx,.ppt,.pptx,application/zip,text/csv',
  audio: 'audio/mpeg,audio/mp4,audio/wav',
}

const NOUN: Record<UploadKindName, string> = {
  image: 'image',
  video: 'film',
  document: 'document',
  audio: 'audio file',
}

export function UploadField({
  name,
  kind,
  enabled,
  defaultValue = '',
  placeholder,
  error,
  hint,
  id,
  required,
  showPreview = true,
}: {
  name: string
  kind: UploadKindName
  /** Whether a blob store is attached. Decided on the server. */
  enabled: boolean
  defaultValue?: string
  placeholder?: string
  error?: string
  hint?: string
  id?: string
  required?: boolean
  /** Off for fields whose value is rarely an image, such as a map link. */
  showPreview?: boolean
}) {
  const [value, setValue] = useState(defaultValue)
  const [progress, setProgress] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerId = useId()

  const busy = progress !== null

  async function onPick(file: File | undefined) {
    if (!file) return

    setFailure(null)
    setProgress(0)

    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/uploads',
        // Which allow-list and size cap the token is minted against. Named by
        // the form rather than sniffed from the file, so a video field cannot
        // be talked into accepting a 512 MB "image".
        clientPayload: kind,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      })

      setValue(blob.url)
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : 'The upload did not finish. Try again.',
      )
    } finally {
      setProgress(null)
      // Clearing the picker means choosing the same file twice in a row still
      // fires a change event — otherwise a retry after a failure does nothing.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const isImage =
    showPreview &&
    kind === 'image' &&
    value.length > 0 &&
    !value.startsWith('data:')

  return (
    <div className="space-y-2.5">
      <Input
        name={name}
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        error={error}
        hint={hint}
        required={required}
        readOnly={busy}
      />

      {enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={pickerId}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300',
              'bg-white px-3 py-1.5 text-sm font-medium text-ink-800 transition',
              'hover:border-forest-600 hover:text-forest-700',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <Icon name="upload" className="size-4" />
            {busy ? 'Uploading…' : `Upload a ${NOUN[kind]}`}
          </label>

          <input
            ref={inputRef}
            id={pickerId}
            type="file"
            accept={ACCEPT[kind]}
            className="sr-only"
            disabled={busy}
            onChange={(event) => void onPick(event.target.files?.[0])}
          />

          {busy && (
            <span
              className="flex flex-1 items-center gap-2 text-xs text-ink-600"
              // The percentage changes as the upload runs; announcing every
              // step would talk over the person. The final state is what
              // matters and it is announced by the field's own value changing.
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-200">
                <span
                  className="block h-full rounded-full bg-forest-600 transition-[width]"
                  style={{ width: `${Math.round(progress ?? 0)}%` }}
                />
              </span>
              {Math.round(progress ?? 0)}%
            </span>
          )}

          {value && !busy && (
            <button
              type="button"
              onClick={() => setValue('')}
              className="text-sm font-medium text-ink-600 underline-offset-2 hover:text-red-700 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {failure && (
        <p className="flex items-start gap-1.5 text-sm text-red-700" role="alert">
          <Icon name="close" className="mt-0.5 size-3.5 shrink-0" />
          {failure}
        </p>
      )}

      {isImage && (
        // Addresses point anywhere, including a store on another origin, so
        // `next/image` is not usable here — see the note in ui/card.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-24 w-auto max-w-full rounded-lg border border-ink-200 bg-ink-50 object-contain"
        />
      )}
    </div>
  )
}
