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
   * One line — a heading, an eyebrow, the label on a button.
   *
   * Distinct from `prose` because it renders as a single-line input, and that
   * is the whole signal an editor gets about what will fit. A section heading
   * typed into a textarea invites a paragraph, and a paragraph set at display
   * size in a heading slot breaks the band it sits in.
   */
  | { key: string; label: string; hint?: string; kind: 'line'; max?: number }
  /**
   * An image address, with an upload button beside it where a store is
   * attached (see `lib/uploads`). Stored as the address, exactly like every
   * other image on the site.
   */
  | { key: string; label: string; hint?: string; kind: 'image' }
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
    slug: 'home',
    defaultTitle: 'Home',
    description:
      'The homepage. The stories in the hero and the grid are the latest articles; the pictures behind them are the Forum gallery collection in Media. The mission heading and paragraph are in Settings.',
    routes: ['/'],
    blocks: [
      { key: 'newsTitle', label: 'News grid — heading', kind: 'line', max: 90 },
      {
        key: 'newsLinkLabel',
        label: 'News grid — link to the blog',
        kind: 'line',
        max: 40,
      },
      {
        key: 'missionEyebrow',
        label: 'Mission — eyebrow',
        hint: 'The heading and paragraph under it are the intro settings in Settings.',
        kind: 'line',
        max: 60,
      },
      { key: 'aboutTitle', label: 'Who we are — heading', kind: 'line', max: 90 },
      {
        key: 'aboutBody',
        label: 'Who we are — first paragraph',
        kind: 'prose',
        rows: 5,
      },
      {
        key: 'aboutBodyTwo',
        label: 'Who we are — second paragraph',
        kind: 'prose',
        rows: 4,
      },
      {
        key: 'quote',
        label: 'Pull quote',
        hint: 'Set at display size over a photograph from the Forum gallery.',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'quoteAttribution',
        label: 'Pull quote — attribution',
        kind: 'line',
        max: 60,
      },
      { key: 'contactTitle', label: 'Contact band — heading', kind: 'line', max: 90 },
      { key: 'contactLead', label: 'Contact band — standfirst', kind: 'prose', rows: 2 },
      { key: 'contactLabel', label: 'Contact band — button', kind: 'line', max: 40 },
    ],
  },
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
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'summaryEyebrow',
        label: 'Who leads the forum — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'summaryTitle',
        label: 'Who leads the forum — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'officersEyebrow',
        label: 'The board and officers — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'officersTitle',
        label: 'The board and officers — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'officersLead',
        label: 'The board and officers — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'documentsEyebrow',
        label: 'Governance documents — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'documentsTitle',
        label: 'Governance documents — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'documentsLead',
        label: 'Governance documents — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaLinkLabel',
        label: 'Closing call to action — button',
        kind: 'line',
        max: 40,
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
      {
        key: 'stepsEyebrow',
        label: 'How to join — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'stepsTitle',
        label: 'How to join — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'accessEyebrow',
        label: 'What membership opens — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'accessTitle',
        label: 'What membership opens — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'introEyebrow',
        label: 'Introduction — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'introTitle',
        label: 'Introduction — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'membersEyebrow',
        label: 'Who is already in — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'membersTitle',
        label: 'Who is already in — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'membersLead',
        label: 'Who is already in — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'sessionsEyebrow',
        label: 'Sessions — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'sessionsTitle',
        label: 'Sessions — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sessionsLead',
        label: 'Sessions — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'sessionsLinkLabel',
        label: 'Sessions — link',
        kind: 'line',
        max: 40,
      },
      {
        key: 'faqEyebrow',
        label: 'Questions — eyebrow',
        kind: 'line',
        max: 40,
      },
      { key: 'faqTitle', label: 'Questions — heading', kind: 'line', max: 90 },
      {
        key: 'faqLead',
        label: 'Questions — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'tiersHeroEyebrow',
        label: 'Tiers page — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'tiersHeroTitle',
        label: 'Tiers page — headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersHeroAccent',
        label: 'Tiers page — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'tiersHeroLead',
        label: 'Tiers page — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'tiersEmptyTitle',
        label: 'Tiers page — no tiers, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersEmptyMessage',
        label: 'Tiers page — no tiers, message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'tiersSavingEyebrow',
        label: 'Tiers page — the arithmetic, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'tiersSavingTitle',
        label: 'Tiers page — the arithmetic, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersSavingLead',
        label: 'Tiers page — the arithmetic, standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'tiersSavingCaption',
        label: 'Tiers page — under the saving figure',
        kind: 'line',
        max: 60,
      },
      {
        key: 'tiersPayingEyebrow',
        label: 'Tiers page — paying, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'tiersPayingTitle',
        label: 'Tiers page — paying, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersPayingLead',
        label: 'Tiers page — paying, standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'tiersFaqEyebrow',
        label: 'Tiers page — questions, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'tiersFaqTitle',
        label: 'Tiers page — questions, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersCtaTitle',
        label: 'Tiers page — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'tiersCtaLead',
        label: 'Tiers page — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'applyEyebrow',
        label: 'Apply page — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'applyTitle',
        label: 'Apply page — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'applyAccent',
        label: 'Apply page — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'applyLead',
        label: 'Apply page — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'applyEmptyTitle',
        label: 'Apply page — closed, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'applyEmptyMessage',
        label: 'Apply page — closed, message',
        kind: 'prose',
        rows: 2,
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
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'emptyTitle',
        label: 'No sponsors yet — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'No sponsors yet — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'emptyLinkLabel',
        label: 'No sponsors yet — button',
        kind: 'line',
        max: 40,
      },
      {
        key: 'whyEyebrow',
        label: 'Why sponsor — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'whyTitle',
        label: 'Why sponsor — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'packagesEyebrow',
        label: 'Packages — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'packagesTitle',
        label: 'Packages — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'packagesLead',
        label: 'Packages — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'exhibitingEyebrow',
        label: 'Exhibiting — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'exhibitingTitle',
        label: 'Exhibiting — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'enquiryEyebrow',
        label: 'The enquiry form — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'enquiryTitle',
        label: 'The enquiry form — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'enquiryLead',
        label: 'The enquiry form — standfirst',
        kind: 'prose',
        rows: 2,
      },
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
      {
        key: 'eyebrow',
        label: 'Eyebrow',
        hint: 'Replaced by the forum’s dates once one is published.',
        kind: 'line',
        max: 40,
      },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'mapLinkLabel', label: 'Map button', kind: 'line', max: 40 },
      {
        key: 'venueEyebrow',
        label: 'The venue — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guidanceEyebrow',
        label: 'Travel guidance — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guidanceTitle',
        label: 'Travel guidance — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'guidanceLead',
        label: 'Travel guidance — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'invitationNote',
        label: 'Letters of invitation — note',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'accessEyebrow',
        label: 'Accessibility — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'accessTitle',
        label: 'Accessibility — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
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
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'sectorsEyebrow',
        label: 'Sector guides — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'sectorsTitle',
        label: 'Sector guides — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsLead',
        label: 'Sector guides — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
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
  {
    slug: 'events',
    defaultTitle: 'Forum overview',
    description:
      'The forum overview page. The event\'s own name, theme, dates and venue are edited under Forums.',
    routes: ['/events'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The words before the session count, which the page counts for itself.',
        kind: 'line',
        max: 120,
      },
      {
        key: 'agendaLinkLabel',
        label: 'Link to the full agenda',
        kind: 'line',
        max: 40,
      },
      {
        key: 'themeEyebrow',
        label: 'The theme — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'themeFallback',
        label: 'The theme — heading when the forum has none set',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'pendingTitle',
        label: 'No forum yet — headline',
        hint: 'Shown when no forum is published. The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'pendingAccent',
        label: 'No forum yet — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'pendingLead',
        label: 'No forum yet — standfirst',
        kind: 'prose',
        rows: 3,
      },
    ],
  },
  {
    slug: 'agenda',
    defaultTitle: 'Agenda',
    description:
      'The programme page. The sessions, tracks and speakers themselves are edited under Programme.',
    routes: ['/events/agenda'],
    blocks: [
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'pendingEyebrow',
        label: 'No programme yet — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'pendingTitle',
        label: 'No programme yet — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'pendingAccent',
        label: 'No programme yet — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'pendingLead',
        label: 'No programme yet — standfirst',
        kind: 'prose',
        rows: 3,
      },
    ],
  },
  {
    slug: 'speakers',
    defaultTitle: 'Speakers',
    description:
      'The speaker index and each speaker’s own page. The speakers themselves are edited under Speakers.',
    routes: ['/events/speakers'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'heroLeadPrefix',
        label: 'Standfirst — before the forum’s name',
        hint: 'The forum’s name is printed between these two.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroLeadSuffix',
        label: 'Standfirst — after the forum’s name',
        kind: 'line',
        max: 140,
      },
      {
        key: 'heroLeadNoEvent',
        label: 'Standfirst when no forum is published',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'emptyTitle',
        label: 'No matches — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'No matches — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaProposeLabel',
        label: 'Closing call to action — button',
        kind: 'line',
        max: 40,
      },
      {
        key: 'detailCtaTitle',
        label: 'One speaker — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'detailCtaLead',
        label: 'One speaker — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'leadership',
    defaultTitle: 'Leadership',
    description:
      'The officers and secretariat page. The profiles themselves are seeded and edited in the database.',
    routes: ['/about/leadership'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'officersEyebrow',
        label: 'Officers — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'officersTitle',
        label: 'Officers — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'officersLead',
        label: 'Officers — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'secretariatEyebrow',
        label: 'Secretariat — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'secretariatTitle',
        label: 'Secretariat — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'secretariatLead',
        label: 'Secretariat — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'emptyTitle',
        label: 'No profiles yet — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'No profiles yet — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaLinkLabel',
        label: 'Closing call to action — button',
        kind: 'line',
        max: 40,
      },
    ],
  },
  {
    slug: 'partners',
    defaultTitle: 'Partners',
    description:
      'The partners, affiliations and supporters page. The organisations themselves are seeded and edited in the database.',
    routes: ['/about/partners'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'partnersEyebrow',
        label: 'Institutional partners — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'partnersTitle',
        label: 'Institutional partners — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'partnersLead',
        label: 'Institutional partners — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'affiliationsEyebrow',
        label: 'Affiliations — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'affiliationsTitle',
        label: 'Affiliations — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'affiliationsLead',
        label: 'Affiliations — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'supportersEyebrow',
        label: 'Supporters — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'supportersTitle',
        label: 'Supporters — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'supportersLead',
        label: 'Supporters — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'emptyTitle',
        label: 'No partners yet — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'No partners yet — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaLinkLabel',
        label: 'Closing call to action — button',
        kind: 'line',
        max: 40,
      },
    ],
  },
  {
    slug: 'blog',
    defaultTitle: 'News & insights',
    description:
      'The blog index and the wording around each article. The articles themselves are written under Articles.',
    routes: ['/blog'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 2 },
      {
        key: 'emptyTitle',
        label: 'Nothing published — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'Nothing published — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'articleMoreEyebrow',
        label: 'One article — more from the forum — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'articleMoreTitle',
        label: 'One article — more from the forum — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'articleCtaTitle',
        label: 'One article — closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'articleCtaLead',
        label: 'One article — closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'contact',
    defaultTitle: 'Contact',
    description:
      'The wording on the contact page. The email, phones and address are in Settings.',
    routes: ['/contact'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'formEyebrow',
        label: 'The form — eyebrow',
        kind: 'line',
        max: 40,
      },
      { key: 'formTitle', label: 'The form — heading', kind: 'line', max: 90 },
      {
        key: 'directHeading',
        label: 'Contact details — heading',
        kind: 'line',
        max: 90,
      },
    ],
  },
  {
    slug: 'deal-room',
    defaultTitle: 'Deal Room',
    description:
      'The Deal Room index, the funding application and each proposition’s page. The propositions themselves are reviewed under Deal Room.',
    routes: ['/deal-room', '/deal-room/apply'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'howEyebrow',
        label: 'How it works — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'howTitle',
        label: 'How it works — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'businessDoorTitle',
        label: 'For businesses — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'businessDoorBody',
        label: 'For businesses — description',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'businessDoorLabel',
        label: 'For businesses — button',
        kind: 'line',
        max: 40,
      },
      {
        key: 'investorDoorTitle',
        label: 'For investors — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'investorDoorBody',
        label: 'For investors — description',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'investorDoorLabel',
        label: 'For investors — button',
        kind: 'line',
        max: 40,
      },
      {
        key: 'disclosureEyebrow',
        label: 'What is published — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'disclosureTitle',
        label: 'What is published — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'applyEyebrow',
        label: 'Apply for funding — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'applyTitle',
        label: 'Apply for funding — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'applyAccent',
        label: 'Apply for funding — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'applyLead',
        label: 'Apply for funding — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'detailRelatedEyebrow',
        label: 'One proposition — related eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'detailCtaTitle',
        label: 'One proposition — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'detailCtaLead',
        label: 'One proposition — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'directory',
    defaultTitle: 'Business directory',
    description:
      'The directory index and each listing’s page. The listings themselves are written by members and moderated under Members.',
    routes: ['/directory'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      { key: 'heroLead', label: 'Hero standfirst', kind: 'prose', rows: 3 },
      {
        key: 'emptyTitle',
        label: 'No matches — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'emptyMessage',
        label: 'No matches — message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'detailRelatedEyebrow',
        label: 'One listing — related eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'detailCtaTitle',
        label: 'One listing — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'detailCtaLead',
        label: 'One listing — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'learning-hub',
    defaultTitle: 'Learning Hub',
    description:
      'The Learning Hub and its four libraries — sector guides, recordings, downloads and each sector’s own page. The files are added under Media.',
    routes: ['/learning-hub', '/learning-hub/sectors', '/learning-hub/recordings', '/learning-hub/downloads'],
    blocks: [
      {
        key: 'membershipEyebrow',
        label: 'Membership — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'membershipTitle',
        label: 'Membership — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'membershipBody',
        label: 'Membership — paragraph',
        kind: 'prose',
        rows: 5,
      },
      {
        key: 'librariesEyebrow',
        label: 'The libraries — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'librariesTitle',
        label: 'The libraries — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsEyebrow',
        label: 'Sector guides — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'sectorsTitle',
        label: 'Sector guides — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsLead',
        label: 'Sector guides — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'sectorsLinkLabel',
        label: 'Sector guides — link',
        kind: 'line',
        max: 40,
      },
      {
        key: 'speakersEyebrow',
        label: 'Speakers — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'speakersTitle',
        label: 'Speakers — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'speakersLead',
        label: 'Speakers — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'speakersLinkLabel',
        label: 'Speakers — link',
        kind: 'line',
        max: 40,
      },
      {
        key: 'ctaTitle',
        label: 'Closing call to action — heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'ctaLead',
        label: 'Closing call to action — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'sectorsHeroTitle',
        label: 'Sector guides page — headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsHeroAccent',
        label: 'Sector guides page — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'sectorsHeroLead',
        label: 'Sector guides page — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'sectorsEmptyTitle',
        label: 'Sector guides page — nothing yet, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsEmptyMessage',
        label: 'Sector guides page — nothing yet, message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'sectorsCtaTitle',
        label: 'Sector guides page — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'sectorsCtaLead',
        label: 'Sector guides page — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'recordingsEyebrow',
        label: 'Recordings page — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'recordingsHeroTitle',
        label: 'Recordings page — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'recordingsHeroAccent',
        label: 'Recordings page — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'recordingsHeroLead',
        label: 'Recordings page — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'recordingsEmptyTitle',
        label: 'Recordings page — nothing yet, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'recordingsEmptyMessage',
        label: 'Recordings page — nothing yet, message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'recordingsCtaTitle',
        label: 'Recordings page — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'recordingsCtaLead',
        label: 'Recordings page — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'downloadsEyebrow',
        label: 'Downloads page — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'downloadsHeroTitle',
        label: 'Downloads page — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'downloadsHeroAccent',
        label: 'Downloads page — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'downloadsHeroLead',
        label: 'Downloads page — standfirst',
        kind: 'prose',
        rows: 3,
      },
      {
        key: 'downloadsEmptyTitle',
        label: 'Downloads page — nothing yet, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'downloadsEmptyMessage',
        label: 'Downloads page — nothing yet, message',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'downloadsFeaturedEyebrow',
        label: 'Downloads page — this year’s eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'downloadsFeaturedTitle',
        label: 'Downloads page — this year’s heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'downloadsCtaTitle',
        label: 'Downloads page — closing heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'downloadsCtaLead',
        label: 'Downloads page — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'guideEyebrow',
        label: 'One sector guide — eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideCaseEyebrow',
        label: 'One sector guide — the case, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideCaseTitle',
        label: 'One sector guide — the case, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'guideIncentivesEyebrow',
        label: 'One sector guide — incentives, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideIncentivesTitle',
        label: 'One sector guide — incentives, heading',
        kind: 'line',
        max: 90,
      },
      {
        key: 'guideDealRoomEyebrow',
        label: 'One sector guide — propositions, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideDirectoryEyebrow',
        label: 'One sector guide — members, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideSpeakersEyebrow',
        label: 'One sector guide — speakers, eyebrow',
        kind: 'line',
        max: 40,
      },
      {
        key: 'guideCtaLead',
        label: 'One sector guide — closing standfirst',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'register',
    defaultTitle: 'Registration',
    description:
      'What the registration page says when a forum is not yet open. The tickets and prices are seeded and edited in the database.',
    routes: ['/register'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'notifyLabel',
        label: 'Button — tell me when it opens',
        kind: 'line',
        max: 40,
      },
      {
        key: 'closedTitle',
        label: 'No forum — headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'closedAccent',
        label: 'No forum — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'closedLead',
        label: 'No forum — standfirst',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'closedEmptyTitle',
        label: 'No forum — heading below',
        kind: 'line',
        max: 90,
      },
      {
        key: 'soonTitle',
        label: 'Not on sale yet — headline',
        kind: 'line',
        max: 90,
      },
      {
        key: 'soonAccent',
        label: 'Not on sale yet — headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'soonEmptyTitle',
        label: 'Not on sale yet — heading below',
        kind: 'line',
        max: 90,
      },
      {
        key: 'soonEmptyMessage',
        label: 'Not on sale yet — message',
        kind: 'prose',
        rows: 2,
      },
    ],
  },
  {
    slug: 'search',
    defaultTitle: 'Search',
    description:
      'The wording on the search page. What it searches is fixed: articles, speakers, sectors and the directory.',
    routes: ['/search'],
    blocks: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'line', max: 40 },
      {
        key: 'heroTitle',
        label: 'Hero headline',
        hint: 'The hero headline splits in two so the last words can be set in the accent colour.',
        kind: 'line',
        max: 90,
      },
      {
        key: 'heroAccent',
        label: 'Hero headline accent',
        kind: 'line',
        max: 40,
      },
      {
        key: 'placeholder',
        label: 'Search box placeholder',
        kind: 'line',
        max: 90,
      },
      {
        key: 'promptMessage',
        label: 'Before anything is typed',
        kind: 'prose',
        rows: 2,
      },
      {
        key: 'emptyMessage',
        label: 'Nothing found — message',
        kind: 'prose',
        rows: 2,
      },
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
