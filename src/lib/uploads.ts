import 'server-only'

/**
 * Uploading files (§4.14, FR-01).
 *
 * The media library was built to hold *addresses* rather than files, because
 * the app has no writable disk: Vercel's filesystem is read-only, `public/` is
 * baked into the deployment, and a half-working upload button is worse than an
 * address field that plainly asks for an address. That reasoning still holds
 * for the disk. It does not hold for object storage, which is what this module
 * adds — the secretariat can now choose a photograph on their laptop and have
 * it appear on the homepage, without anyone touching a repository.
 *
 * The file goes from the browser **straight to the store**, not through this
 * app. A serverless function may only receive about 4.5 MB of request body, so
 * routing a forum highlights reel through a server action would fail on the
 * files most worth uploading — and would fail late, after the whole upload had
 * been sent. The browser asks `/api/uploads` for a short-lived token, uploads
 * with it, and posts back only the resulting address, which is the same string
 * the address field always held. Everything downstream of the address is
 * therefore unchanged.
 *
 * Uploads are **optional**. With no `BLOB_READ_WRITE_TOKEN` in the environment
 * — a checkout with no store attached, which is every local clone — the
 * controls fall back to the address field alone rather than offering a button
 * that cannot work. `uploadsEnabled` is the single test for that, and it is
 * asked on the server so the answer cannot be spoofed from a stale tab.
 */

/**
 * Whether a blob store is attached.
 *
 * The token is what `@vercel/blob` reads to authenticate, so its presence is
 * the honest test — checking a separate feature flag would let the two
 * disagree, and the failure would only show at the moment someone tried to
 * upload.
 */
export function uploadsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * What each kind of upload will accept, as a MIME allow-list.
 *
 * Declared per purpose rather than as one list, because the answer genuinely
 * differs: a speaker photograph must not be a 200 MB video, and a delegate
 * pack must not be an executable. The browser gets the same list as the
 * `accept` attribute — a convenience, since the file picker filters on it —
 * and the token route checks it again, because `accept` is advisory and a
 * crafted request ignores it.
 */
export const UPLOAD_KINDS = {
  image: {
    label: 'image',
    types: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/svg+xml',
    ],
    /** 12 MB. A photograph off a phone is 3-6 MB; a raw export is not for the web. */
    maxBytes: 12 * 1024 * 1024,
  },
  video: {
    label: 'video',
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    /** 512 MB. The hero clips are short, but they are shot at full resolution. */
    maxBytes: 512 * 1024 * 1024,
  },
  document: {
    label: 'document',
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'text/csv',
    ],
    maxBytes: 64 * 1024 * 1024,
  },
  audio: {
    label: 'audio',
    types: ['audio/mpeg', 'audio/mp4', 'audio/wav'],
    maxBytes: 128 * 1024 * 1024,
  },
} as const

export type UploadKind = keyof typeof UPLOAD_KINDS

export function isUploadKind(value: string): value is UploadKind {
  return Object.hasOwn(UPLOAD_KINDS, value)
}

/**
 * Where a given kind of upload is filed in the store.
 *
 * A flat store becomes unreadable the moment it holds more than a season's
 * photographs, and the store's own browser is the only place anyone will ever
 * look for a file whose row was deleted. The random suffix is added by the
 * store itself, so two files named `logo.png` never collide.
 */
export function uploadFolder(kind: UploadKind): string {
  return `fbf/${kind}s`
}
