import 'server-only'

/**
 * What the page editor is allowed to edit (§15, FR-01).
 *
 * A `Page` row carries its copy as `bodyJson`, a map of named blocks. Nothing
 * in the database says which names a given page has: the route file that
 * renders the page decides, by reading the keys it knows about and falling back
 * to copy in the source when one is missing. `about/governance` reads `board`
 * and `committees`, `privacy` reads `retention` and `cookies`, and neither page
 * has any way to advertise that.
 *
 * So the block set is declared here instead, once, and this file is the
 * contract between the route files and the editor. Two things follow from that,
 * and both are the point rather than a limitation:
 *
 *   * **The editor never invents keys.** A free-form "add a block" control would
 *     let staff write copy under a name no route reads, and it would simply
 *     never appear on the site — with nothing on the screen to explain why. Only
 *     the keys below are offered, and only they are saved.
 *   * **Slugs are not editable.** The slug is how the route finds its copy, so
 *     renaming one silently empties a public page. Pages are created here by
 *     the editor when first saved, under the slug named below, and never
 *     renamed.
 *
 * Adding a block to a page is therefore a two-line change: read it in the route
 * file, and declare it here so somebody can write it.
 *
 * Several blocks below have no value in the database yet. That is deliberate
 * and is the main reason this screen exists — `governance` and `sponsorship`
 * have no row at all, and their routes have been rendering their in-source
 * fallbacks since launch. They are listed so the secretariat can fill them.
 */

/** One field of a repeating item — see `list` blocks below. */
export type CmsListField = {
  name: string
  label: string
  /** `line` is a single-line input; `prose` is a small textarea. */
  kind: 'line' | 'prose'
  /** Blank is allowed. Every other field is required on a saved item. */
  optional?: boolean
}

export type CmsBlock =
  /** Plain copy. Blank lines separate paragraphs, as `paragraphs()` renders it. */
  | { key: string; label: string; hint?: string; kind: 'prose'; rows?: number }
  /**
   * A repeating structure, stored as a JSON array *inside* the block value —
   * the route parses it with `parseJsonColumn`. The editor shows one card per
   * item rather than asking anyone to write JSON by hand.
   */
  | {
      key: string
      label: string
      hint?: string
      kind: 'list'
      itemNoun: string
      fields: CmsListField[]
    }

export type CmsPage = {
  slug: string
  /** Used when the row does not exist yet and the editor has to create it. */
  defaultTitle: string
  /** What this page is, on the index screen. */
  description: string
  /**
   * The public paths this copy feeds. Revalidated on save, and offered as
   * "view" links on the editor. More than one where a block is shared: the
   * `about` body is read by the governance page too.
   */
  routes: string[]
  blocks: CmsBlock[]
}

export const CMS_PAGES: CmsPage[] = [
  {
    slug: 'about',
    defaultTitle: 'About the Freetown Business Forum',
    description: "The forum's own story — what it is, what it is for, who runs it.",
    routes: ['/about', '/about/governance'],
    blocks: [
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 4 },
      { key: 'vision', label: 'Vision', kind: 'prose', rows: 4 },
      { key: 'mandate', label: 'Mandate', kind: 'prose', rows: 6 },
      {
        key: 'governance',
        label: 'Governance summary',
        hint: 'Shown on the governance page when that page has no introduction of its own.',
        kind: 'prose',
        rows: 4,
      },
    ],
  },
  {
    slug: 'governance',
    defaultTitle: 'Governance',
    description:
      'How the forum is run and who answers for it. No copy has been written yet — the page is showing its built-in fallbacks.',
    routes: ['/about/governance'],
    blocks: [
      {
        key: 'intro',
        label: 'Introduction',
        hint: "Replaces the About page's governance summary when set.",
        kind: 'prose',
        rows: 4,
      },
      { key: 'board', label: 'The board', kind: 'prose', rows: 4 },
      { key: 'committees', label: 'Committees', kind: 'prose', rows: 4 },
      {
        key: 'membership',
        label: 'Membership and the general meeting',
        kind: 'prose',
        rows: 4,
      },
      {
        key: 'finance',
        label: 'Finance and accountability',
        kind: 'prose',
        rows: 4,
      },
      {
        key: 'ethics',
        label: 'Conduct and conflicts of interest',
        kind: 'prose',
        rows: 4,
      },
    ],
  },
  {
    slug: 'membership',
    defaultTitle: 'Membership',
    description:
      'The membership pitch, the joining steps and the questions people ask before paying.',
    routes: ['/membership', '/membership/tiers'],
    blocks: [
      {
        key: 'heroLead',
        label: 'Hero standfirst',
        hint: 'The sentence under the page title.',
        kind: 'prose',
        rows: 3,
      },
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 4 },
      {
        key: 'access',
        label: 'What membership opens',
        hint: 'Three items read best — a fourth wraps to a second row and reads as an afterthought.',
        kind: 'list',
        itemNoun: 'item',
        fields: [
          { name: 'title', label: 'Title', kind: 'line' },
          { name: 'body', label: 'Description', kind: 'prose' },
          { name: 'href', label: 'Link address', kind: 'line' },
          { name: 'linkLabel', label: 'Link text', kind: 'line' },
        ],
      },
      {
        key: 'steps',
        label: 'How to join',
        hint: 'Numbered on the page, in the order below.',
        kind: 'list',
        itemNoun: 'step',
        fields: [
          { name: 'title', label: 'Step', kind: 'line' },
          { name: 'body', label: 'Description', kind: 'prose' },
        ],
      },
      {
        key: 'faq',
        label: 'Frequently asked questions',
        hint: 'Shown on both the membership page and the tiers page.',
        kind: 'list',
        itemNoun: 'question',
        fields: [
          { name: 'q', label: 'Question', kind: 'line' },
          { name: 'a', label: 'Answer', kind: 'prose' },
        ],
      },
    ],
  },
  {
    slug: 'sponsorship',
    defaultTitle: 'Sponsorship',
    description:
      'The sponsorship and exhibiting pitch. No copy has been written yet — the page is showing its built-in fallbacks.',
    routes: ['/events/sponsors'],
    blocks: [
      {
        key: 'heroLead',
        label: 'Hero standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'why',
        label: 'What sponsorship buys',
        kind: 'prose',
        rows: 4,
      },
      { key: 'exhibiting', label: 'Exhibiting', kind: 'prose', rows: 5 },
    ],
  },
  {
    slug: 'venue-travel',
    defaultTitle: 'Venue & Travel',
    description: 'Getting to Freetown, visas, hotels and what to expect on the day.',
    routes: ['/events/venue'],
    blocks: [
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 4 },
      { key: 'gettingHere', label: 'Getting here', kind: 'prose', rows: 5 },
      { key: 'visas', label: 'Visas and entry', kind: 'prose', rows: 5 },
      { key: 'hotels', label: 'Where to stay', kind: 'prose', rows: 5 },
      { key: 'practical', label: 'Practical notes', kind: 'prose', rows: 5 },
      {
        key: 'accessibility',
        label: 'Accessibility',
        hint: 'Step-free access, hearing loops, and who to contact about a specific requirement.',
        kind: 'prose',
        rows: 4,
      },
    ],
  },
  {
    slug: 'doing-business',
    defaultTitle: 'Doing Business in Sierra Leone',
    description:
      'The Learning Hub primer for an investor who has not traded here before.',
    routes: ['/learning-hub/doing-business'],
    blocks: [
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 4 },
      { key: 'registration', label: 'Registering a company', kind: 'prose', rows: 5 },
      { key: 'tax', label: 'Tax', kind: 'prose', rows: 5 },
      { key: 'incentives', label: 'Investment incentives', kind: 'prose', rows: 5 },
      { key: 'land', label: 'Land and property', kind: 'prose', rows: 5 },
      { key: 'labour', label: 'Employing people', kind: 'prose', rows: 5 },
      { key: 'banking', label: 'Banking and payments', kind: 'prose', rows: 5 },
      { key: 'imports', label: 'Imports and exports', kind: 'prose', rows: 5 },
      { key: 'disputes', label: 'Contracts and disputes', kind: 'prose', rows: 5 },
    ],
  },
  {
    slug: 'privacy',
    defaultTitle: 'Privacy Policy',
    description: 'What the forum collects, why, and what a person can ask of it.',
    routes: ['/privacy'],
    blocks: [
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 3 },
      { key: 'collection', label: 'What we collect', kind: 'prose', rows: 5 },
      { key: 'use', label: 'How we use it', kind: 'prose', rows: 5 },
      { key: 'payments', label: 'Payments and card data', kind: 'prose', rows: 5 },
      { key: 'sharing', label: 'Who we share it with', kind: 'prose', rows: 5 },
      { key: 'retention', label: 'How long we keep it', kind: 'prose', rows: 5 },
      { key: 'cookies', label: 'Cookies', kind: 'prose', rows: 5 },
      { key: 'rights', label: 'Your rights', kind: 'prose', rows: 5 },
    ],
  },
  {
    slug: 'terms',
    defaultTitle: 'Terms & Conditions',
    description: 'The terms a delegate or member agrees to when they book or join.',
    routes: ['/terms'],
    blocks: [
      { key: 'intro', label: 'Introduction', kind: 'prose', rows: 3 },
      {
        key: 'registration',
        label: 'Registration and payment',
        kind: 'prose',
        rows: 5,
      },
      {
        key: 'cancellation',
        label: 'Cancellations and refunds',
        kind: 'prose',
        rows: 5,
      },
      { key: 'membership', label: 'Membership', kind: 'prose', rows: 5 },
      { key: 'conduct', label: 'Conduct at the forum', kind: 'prose', rows: 5 },
      {
        key: 'content',
        label: 'Photography, recording and content',
        kind: 'prose',
        rows: 5,
      },
      { key: 'liability', label: 'Liability', kind: 'prose', rows: 5 },
      { key: 'law', label: 'Governing law', kind: 'prose', rows: 5 },
    ],
  },
]

export function findCmsPage(slug: string): CmsPage | null {
  return CMS_PAGES.find((page) => page.slug === slug) ?? null
}

/**
 * The form field carrying one block's value.
 *
 * Prefixed so the action can tell a block apart from `title` or `status`
 * without keeping a second list of reserved names, and so a block called
 * `title` — which nothing forbids — could never collide with the page's own.
 */
export function blockField(key: string): string {
  return `block:${key}`
}
