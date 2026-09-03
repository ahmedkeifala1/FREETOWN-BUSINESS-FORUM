import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

import { AuditAction, record } from '@/lib/audit'
import { assertPermission, Permission } from '@/lib/rbac'
import {
  isUploadKind,
  UPLOAD_KINDS,
  uploadsEnabled,
  type UploadKind,
} from '@/lib/uploads'

/**
 * Minting the short-lived token a browser uploads with (§4.14, §14).
 *
 * The file itself never passes through this route — see `lib/uploads` for why
 * it must not. What passes through is the decision: *may this person put a
 * file of this kind in the store, and how large may it be?* The token the
 * store issues carries that decision, and it expires.
 *
 * Three checks, in order, and each one matters on its own:
 *
 *   * **Signed in with CONTENT_EDIT.** The session cookie rides along with the
 *     browser's request, so the same permission that guards the media screen
 *     guards the token. Without this the route is an open write endpoint on a
 *     paid store — the kind of thing that is discovered by a bill.
 *   * **The kind is one we declared.** The browser names it in `clientPayload`
 *     and an unknown name is refused rather than defaulted, because a default
 *     here would be the most permissive limit applied to the least expected
 *     upload.
 *   * **Content type and size, from the manifest.** `accept` on the file input
 *     is advisory and a crafted request ignores it, so the real limit is the
 *     one written into the token.
 *
 * `onUploadCompleted` records the upload in the audit log. It is called by the
 * store rather than by the browser, so it is the only report of the finished
 * file that a closed laptop cannot cut short — but for that same reason it does
 * not run against a local development server, which the store cannot reach.
 * Nothing depends on it having run: the address is the browser's to post back,
 * and the media row is written by the ordinary form action.
 */

export async function POST(request: Request): Promise<NextResponse> {
  if (!uploadsEnabled()) {
    return NextResponse.json(
      {
        error:
          'File uploads are not configured on this deployment. Paste a file address instead.',
      },
      { status: 501 },
    )
  }

  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_EDIT)
  } catch (error) {
    // 403 for both cases. Distinguishing "not signed in" from "not allowed"
    // tells an unauthenticated prober which accounts exist.
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const kind = String(clientPayload ?? '')

        if (!isUploadKind(kind)) {
          throw new Error('That is not a kind of file this site accepts.')
        }

        const rules = UPLOAD_KINDS[kind as UploadKind]

        return {
          allowedContentTypes: [...rules.types],
          maximumSizeInBytes: rules.maxBytes,
          // A suffix on every name, so uploading a second `logo.png` does not
          // silently replace the first — which some other page is still
          // pointing at.
          addRandomSuffix: true,
          // Carried through to `onUploadCompleted`, which has no session of
          // its own: it is called by the store, not by the browser.
          tokenPayload: JSON.stringify({ userId: staff.id, kind }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let userId: string | undefined
        try {
          userId = (JSON.parse(tokenPayload ?? '{}') as { userId?: string })
            .userId
        } catch {
          userId = undefined
        }

        if (!userId) return

        await record({
          userId,
          action: AuditAction.MEDIA_UPLOAD,
          entityType: 'Upload',
          summary: `Uploaded ${blob.pathname}.`,
          metadata: { url: blob.url, pathname: blob.pathname },
        })
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    // The store's own refusals — too large, wrong type — arrive here as
    // errors, and the message is the useful thing to put on the screen.
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
