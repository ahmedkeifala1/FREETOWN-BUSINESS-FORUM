import { z } from 'zod'

import { parseMoneyToMinor } from '@/lib/money'
import {
  AccessRequestStatus,
  ApplicationStatus,
  BusinessSize,
  ContentStatus,
  DiscountType,
  FormType,
  LeadershipGroup,
  MediaKind,
  MemberStatus,
  OpportunityStage,
  OpportunityStatus,
  PartnerKind,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  RegistrationStatus,
  Role,
  SessionType,
  SL_REGIONS,
  SpeakerRole,
  SponsorTier,
  SubmissionStatus,
} from '@/lib/enums'

/**
 * Runtime validation for every write (NFR-05 "validation", §14).
 *
 * The status columns are `String` in SQLite (see the portability note in
 * prisma/schema.prisma), so the database itself cannot reject a bad value —
 * these schemas are the constraint. Every Server Action parses its FormData
 * here before it touches Prisma; nothing writes a value that has not passed
 * through this module.
 *
 * Error messages are written to be shown to the person filling the form, not
 * to a developer: "Enter a valid Sierra Leone phone number" rather than
 * "Invalid string: does not match pattern".
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/** Turn a `const` object from enums.ts into a zod enum in one step. */
function enumOf<T extends Record<string, string>>(source: T, message: string) {
  return z.enum(Object.values(source) as [string, ...string[]], {
    message,
  })
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  .toLowerCase()

/**
 * Phone numbers are stored as typed, not normalised to E.164 — a delegate
 * quoting "076 123456" at the registration desk should find it recorded the
 * way they said it. Validation is deliberately permissive about spacing and
 * international prefixes because the audience includes overseas investors.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Enter a valid phone number.')
  .max(24, 'That phone number is too long.')
  .regex(/^\+?[0-9\s()-]{6,24}$/, 'Enter a valid phone number.')

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()

/**
 * Passwords: length is the requirement that actually resists guessing, so the
 * floor is 10 characters rather than a shorter password plus a symbol rule
 * that pushes people towards "Password1!".
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'That password is too long.')

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'A slug is required.')
  .max(120, 'That slug is too long.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and hyphens only.',
  )

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(120, 'That is too long.')

export const urlSchema = z
  .string()
  .trim()
  .url('Enter a full web address, including https://')
  .max(500, 'That address is too long.')

export const optionalUrlSchema = z
  .union([urlSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()

/** Trim, then convert an empty string to null — HTML forms submit "" not null. */
export function optionalText(max = 2000) {
  return z
    .string()
    .trim()
    .max(max, 'That is too long.')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
}

/**
 * An enum field that a form may leave blank.
 *
 * `enumOf(...).optional()` accepts `undefined` but not `""`, and a `<select>`
 * whose "Any" option carries an empty value submits `""` — so the plain
 * `.optional()` turns "no answer" into a validation error on a field the form
 * said was optional. This mirrors `optionalText`: empty becomes null and stays
 * out of the row.
 */
export function optionalEnum<T extends Record<string, string>>(
  source: T,
  message: string,
) {
  return z
    .union([enumOf(source, message), z.literal('')])
    .transform((v) => (v === '' ? null : (v as T[keyof T])))
    .nullable()
    .optional()
}

/**
 * A whole-number field that a form may leave blank.
 *
 * `z.coerce.number()` turns "" into 0, which would record a business with no
 * staff as a business with zero staff — a different claim. An empty field
 * becomes null and stays out of the row.
 */
export function optionalCount(max: number) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null

      const parsed = Number(value)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
        ctx.addIssue({ code: 'custom', message: 'Enter a whole number.' })
        return z.NEVER
      }

      return parsed
    })
    .nullable()
    .optional()
}

/** Money always arrives as an integer count of minor units. */
export const amountMinorSchema = z
  .number()
  .int('Enter a whole amount.')
  .min(0, 'An amount cannot be negative.')
  .max(1_000_000_000_000, 'That amount is too large.')

/**
 * A money field as a person types it into a form.
 *
 * `amountMinorSchema` above is the storage contract — an integer count of
 * minor units — and it is what an API or the admin panel sends. A form does
 * not: a delegate types "250,000" meaning two hundred and fifty thousand
 * leones, and FormData delivers that as a string. Parsing it here is what
 * keeps the "no float touches a price" rule intact, because the conversion to
 * minor units happens once, at the boundary, rather than in each action.
 *
 * Both supported currencies have two minor units, so the conversion does not
 * depend on which one the form also submitted. A third currency with a
 * different subdivision would have to make this a per-currency parse.
 */
const moneyFieldSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const minor = parseMoneyToMinor(value)

    if (minor === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount, in figures.' })
      return z.NEVER
    }

    if (minor < 0) {
      ctx.addIssue({ code: 'custom', message: 'An amount cannot be negative.' })
      return z.NEVER
    }

    if (minor > 1_000_000_000_000) {
      ctx.addIssue({ code: 'custom', message: 'That amount is too large.' })
      return z.NEVER
    }

    return minor
  })

/** The same, but an empty field means "not given" rather than an error. */
const optionalMoneyFieldSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null
    const minor = parseMoneyToMinor(value)

    if (minor === null || minor < 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount, in figures.' })
      return z.NEVER
    }

    return minor
  })
  .nullable()
  .optional()

export const currencySchema = z.enum(['SLE', 'USD'], {
  message: 'Choose a supported currency.',
})

export const regionSchema = z.enum(SL_REGIONS, {
  message: 'Choose a region.',
})

/** `<input type="checkbox">` submits "on" when ticked and nothing when not. */
export const checkboxSchema = z
  .union([z.literal('on'), z.literal('true'), z.literal(''), z.undefined()])
  .transform((v) => v === 'on' || v === 'true')

/**
 * A `datetime-local` value, read as UTC.
 *
 * The control submits "2026-11-12T09:00" with no zone attached, and passing
 * that to `new Date` applies the *server's* zone — which would silently move
 * every session on the agenda the moment this app is deployed anywhere but
 * Freetown, and move it again if the host changed its zone. Appending the Z
 * pins it to the UTC that lib/format renders in (NFR-11), so what the event
 * manager typed is what the programme shows. `toDateTimeInput` there is the
 * other half of this pair.
 *
 * Seconds are optional because some browsers include them and most do not.
 */
export const utcDateTimeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
    'Enter a valid date and time.',
  )
  .transform((value) => new Date(`${value.length === 16 ? value + ':00' : value}Z`))
  .refine((date) => !Number.isNaN(date.getTime()), 'Enter a valid date and time.')

/**
 * Manual display order. Absent or blank means 0, which is what an event
 * manager who never touches the field should get — the list then falls back to
 * ordering by time or name, which is already the sensible answer.
 */
export const sortOrderSchema = z
  .union([z.string(), z.number(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === '') return 0
    return Number(value)
  })
  .pipe(
    z
      .number()
      .int('Enter a whole number.')
      .min(0, 'Order cannot be negative.')
      .max(9999, 'That order is too high.'),
  )

// ── Enum schemas ────────────────────────────────────────────────────────────

export const roleSchema = enumOf(Role, 'Choose a valid role.')
export const memberStatusSchema = enumOf(MemberStatus, 'Choose a valid status.')
export const businessSizeSchema = enumOf(BusinessSize, 'Choose a business size.')
export const optionalBusinessSize = optionalEnum(
  BusinessSize,
  'Choose a business size.',
)
export const sessionTypeSchema = enumOf(SessionType, 'Choose a session type.')
export const speakerRoleSchema = enumOf(SpeakerRole, 'Choose a speaker role.')
export const sponsorTierSchema = enumOf(SponsorTier, 'Choose a sponsor tier.')
export const registrationStatusSchema = enumOf(
  RegistrationStatus,
  'Choose a valid registration status.',
)
export const paymentMethodSchema = enumOf(
  PaymentMethod,
  'Choose how you would like to pay.',
)
export const paymentStatusSchema = enumOf(
  PaymentStatus,
  'Choose a valid payment status.',
)
export const paymentPurposeSchema = enumOf(
  PaymentPurpose,
  'Choose what the payment is for.',
)
export const discountTypeSchema = enumOf(DiscountType, 'Choose a discount type.')
export const optionalOpportunityStage = optionalEnum(
  OpportunityStage,
  'Choose a stage.',
)
export const opportunityStageSchema = enumOf(
  OpportunityStage,
  'Choose a business stage.',
)
export const opportunityStatusSchema = enumOf(
  OpportunityStatus,
  'Choose a valid status.',
)
export const applicationStatusSchema = enumOf(
  ApplicationStatus,
  'Choose a valid application status.',
)
export const accessRequestStatusSchema = enumOf(
  AccessRequestStatus,
  'Choose a valid decision.',
)
export const contentStatusSchema = enumOf(ContentStatus, 'Choose a valid status.')
export const mediaKindSchema = enumOf(MediaKind, 'Choose a media type.')
export const formTypeSchema = enumOf(FormType, 'Choose a valid form type.')
export const submissionStatusSchema = enumOf(
  SubmissionStatus,
  'Choose a valid status.',
)
export const partnerKindSchema = enumOf(PartnerKind, 'Choose a partner type.')
export const leadershipGroupSchema = enumOf(
  LeadershipGroup,
  'Choose a leadership group.',
)

// ── Authentication (FR-03) ──────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
  next: optionalText(500),
})

export const signupSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    country: optionalText(80),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: checkboxSchema.refine(
      (v) => v,
      'Please accept the terms and privacy policy.',
    ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'This reset link is not valid.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export const profileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: optionalPhoneSchema,
  country: optionalText(80),
})

// ── Event registration (§4.9, FR-05, FR-06) ─────────────────────────────────

/** Step 1 — ticket selection. The price is never taken from the browser. */
export const ticketSelectionSchema = z.object({
  eventId: z.string().min(1, 'Choose an event.'),
  ticketTypeId: z.string().min(1, 'Choose a ticket type.'),
  quantity: z.coerce
    .number()
    .int('Choose a whole number of delegates.')
    .min(1, 'Choose at least one delegate.')
    .max(100, 'For more than 100 delegates, please contact the secretariat.'),
  currency: currencySchema.default('SLE'),
  promoCode: z
    .string()
    .trim()
    .max(40)
    .transform((v) => (v === '' ? null : v.toUpperCase()))
    .nullable()
    .optional(),
})

/** One attending person. A booking of N produces N of these (FR-05). */
export const delegateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  organisation: optionalText(160),
  jobTitle: optionalText(160),
})

/** Step 2 — lead delegate / billing contact. */
export const registrationDetailsSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  organisation: optionalText(160),
  jobTitle: optionalText(160),
  country: z.string().trim().min(1, 'Choose your country.').max(80),
  dietary: optionalText(300),
  accessibility: optionalText(300),
  groupName: optionalText(160),
})

/** Step 3 — payment method. */
export const paymentSelectionSchema = z
  .object({
    method: paymentMethodSchema,
    payerPhone: optionalPhoneSchema,
  })
  .refine(
    (data) =>
      !['ORANGE_MONEY', 'AFRIMONEY'].includes(data.method) || !!data.payerPhone,
    {
      message: 'Enter the phone number registered to your mobile money wallet.',
      path: ['payerPhone'],
    },
  )

export const checkInSchema = z.object({
  payload: z.string().trim().min(1, 'Scan or enter a ticket code.'),
})

// ── Membership (FR-09) ──────────────────────────────────────────────────────

export const membershipApplicationSchema = z.object({
  tierId: z.string().min(1, 'Choose a membership tier.'),
  organisationName: z
    .string()
    .trim()
    .min(2, 'Enter your organisation name.')
    .max(200),
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  sectorId: optionalText(40),
  region: optionalText(80),
  size: optionalBusinessSize,
  website: optionalUrlSchema.optional(),
  shortDescription: z
    .string()
    .trim()
    .min(20, 'Tell us a little more — at least 20 characters.')
    .max(500, 'Keep this under 500 characters.'),
})

/** A member editing their own directory entry (§4.11). */
export const directoryListingSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name.').max(200),
  sectorId: optionalText(40),
  region: optionalText(80),
  size: optionalBusinessSize,
  shortDescription: z
    .string()
    .trim()
    .min(20, 'Write at least 20 characters.')
    .max(500, 'Keep this under 500 characters.'),
  fullDescription: optionalText(5000),
  logoUrl: optionalUrlSchema.optional(),
  website: optionalUrlSchema.optional(),
  contactEmail: z
    .union([emailSchema, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  contactPhone: optionalPhoneSchema.optional(),
  address: optionalText(300),
  yearFounded: z.coerce
    .number()
    .int()
    .min(1800, 'Enter a valid year.')
    .max(new Date().getFullYear(), 'That year is in the future.')
    .optional(),
  employees: z.coerce
    .number()
    .int()
    .min(0, 'Enter a valid number of employees.')
    .max(1_000_000)
    .optional(),
})

/** Query string for the directory listing page. */
export const directorySearchSchema = z.object({
  q: optionalText(120),
  sector: optionalText(40),
  region: optionalText(80),
  size: optionalBusinessSize,
  page: z.coerce.number().int().min(1).max(1000).default(1),
})

// ── Deal Room (FR-15, §4.12) ────────────────────────────────────────────────

export const fundingApplicationSchema = z.object({
  opportunityId: optionalText(40),
  businessName: z.string().trim().min(2, 'Enter your business name.').max(200),
  contactName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  sectorId: optionalText(40),
  region: optionalText(80),
  amountRequestedMinor: moneyFieldSchema.refine(
    (v) => v > 0,
    'Enter the amount you are seeking.',
  ),
  currency: currencySchema.default('USD'),
  stage: opportunityStageSchema.default(OpportunityStage.GROWTH),
  businessDescription: z
    .string()
    .trim()
    .min(50, 'Describe the business in at least 50 characters.')
    .max(5000),
  useOfFunds: z
    .string()
    .trim()
    .min(50, 'Explain how the funds would be used — at least 50 characters.')
    .max(5000),
  yearsTrading: optionalCount(200),
  employees: optionalCount(1_000_000),
  annualRevenueMinor: optionalMoneyFieldSchema,
})

export const investorAccessRequestSchema = z.object({
  opportunityId: z.string().min(1, 'Choose an opportunity.'),
  investorName: nameSchema,
  organisation: optionalText(200),
  email: emailSchema,
  phone: optionalPhoneSchema.optional(),
  country: optionalText(80),
  investmentFocus: optionalText(500),
  ticketSizeMinor: optionalMoneyFieldSchema,
  currency: currencySchema.default('USD'),
  message: optionalText(2000),
})

export const opportunitySearchSchema = z.object({
  q: optionalText(120),
  sector: optionalText(40),
  region: optionalText(80),
  stage: optionalOpportunityStage,
  page: z.coerce.number().int().min(1).max(1000).default(1),
})

// ── Enquiries, contact and newsletter (FR-12) ───────────────────────────────

export const contactSchema = z.object({
  formType: formTypeSchema.default(FormType.CONTACT),
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema.optional(),
  subject: optionalText(200),
  message: z
    .string()
    .trim()
    .min(10, 'Please write a little more — at least 10 characters.')
    .max(5000, 'Please keep your message under 5000 characters.'),
  /**
   * Honeypot. Real people never see this field, so anything in it is a bot;
   * the action accepts the submission and silently discards it rather than
   * returning an error that would teach the bot to leave it blank.
   */
  website: z.string().max(0).optional(),
})

export const sponsorEnquirySchema = contactSchema.extend({
  organisation: z.string().trim().min(2, 'Enter your organisation.').max(200),
  tier: optionalText(40),
})

export const newsletterSchema = z.object({
  email: emailSchema,
  name: optionalText(120),
  source: optionalText(60),
  website: z.string().max(0).optional(),
})

// ── Admin / CMS (FR-02, FR-13) ──────────────────────────────────────────────

export const articleSchema = z.object({
  title: z.string().trim().min(3, 'Enter a headline.').max(200),
  slug: slugSchema,
  excerpt: z
    .string()
    .trim()
    .min(20, 'Write a standfirst of at least 20 characters.')
    .max(500),
  body: z.string().trim().min(50, 'The article body is too short.'),
  heroImageUrl: optionalUrlSchema.optional(),
  categoryId: optionalText(40),
  status: contentStatusSchema.default(ContentStatus.DRAFT),
  isFeatured: checkboxSchema,
  metaTitle: optionalText(200),
  metaDescription: optionalText(300),
})

/**
 * A latitude or longitude the form may leave blank.
 *
 * Empty has to become null rather than 0: nought and nought is a real place in
 * the Gulf of Guinea, and the venue map draws its pin wherever it is told, so a
 * blank pair coerced to zero would move the Bintumani four hundred miles out to
 * sea rather than simply drawing no map.
 */
function optionalCoordinate(limit: number) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null

      const parsed = Number(value)

      if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid coordinate.' })
        return z.NEVER
      }

      return parsed
    })
    .nullable()
    .optional()
}

/**
 * A textarea holding one item per line, stored as a JSON array column.
 *
 * Blank lines are dropped instead of being kept as empty items: an editor
 * separates points with a blank line as often as not, and an empty bullet on
 * the events page is a rendering fault nobody typed.
 */
export function linesSchema(maxLines: number, maxLength = 300) {
  return z
    .union([z.string(), z.undefined()])
    .transform((value) =>
      (value ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(maxLength, 'One of those lines is too long.'))
        .max(maxLines, `Keep this to ${maxLines} lines.`),
    )
}

/**
 * Where a media file lives: a path this site serves, or a full address
 * somewhere else (§4.14).
 *
 * Both forms are needed and they are treated differently downstream — the
 * homepage plays a `/`-relative film in place and links a hosted one out to its
 * platform — so the difference is preserved rather than normalised away.
 *
 * Two things are refused. A bare `brand/hero/one.jpg` would resolve against
 * whatever page happened to embed it, so it means nothing on its own. A
 * protocol-relative `//example.com/x.jpg` looks like a path and is not one: it
 * is another origin, and an address that reads as local while loading from
 * elsewhere is the one an editor cannot check by eye.
 */
export const assetUrlSchema = z
  .string()
  .trim()
  .min(1, 'Enter the file address.')
  .max(500, 'That address is too long.')
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//')) ||
      /^https?:\/\//i.test(value),
    'Use a path beginning with / for a file on this site, or a full https:// address.',
  )

export const optionalAssetUrlSchema = z
  .union([assetUrlSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()

/**
 * The forum itself (§4.4).
 *
 * Start and end are `datetime-local`, read as UTC by the same rule the
 * programme uses, rather than plain dates. The forum opens at half past eight
 * and closes at five, the agenda derives each session's day number by comparing
 * its date with the event's start, and a start silently rounded to midnight is
 * a start that no longer says when the doors open.
 *
 * `whoAttendsJson` is deliberately not offered here: nothing on the public site
 * reads it yet, and a field an editor fills in that never appears anywhere is
 * worse than a field that is missing.
 */
export const eventSchema = z
  .object({
    name: z.string().trim().min(3, 'Enter the event name.').max(200),
    slug: slugSchema,
    theme: z.string().trim().min(3, 'Enter the event theme.').max(300),
    tagline: optionalText(300),
    startDate: utcDateTimeSchema,
    endDate: utcDateTimeSchema,
    venueName: z.string().trim().min(2, 'Enter the venue.').max(200),
    venueAddress: z.string().trim().min(5, 'Enter the venue address.').max(300),
    city: z.string().trim().max(120).default('Freetown'),
    country: z.string().trim().max(120).default('Sierra Leone'),
    venueMapUrl: optionalUrlSchema.optional(),
    venueLat: optionalCoordinate(90),
    venueLng: optionalCoordinate(180),
    description: optionalText(10_000),
    objectives: linesSchema(12, 300),
    // Not z.coerce.number(): that reads a blank field as nought expected
    // delegates, which the events page would print as "0 delegates" — a claim,
    // and a worse one than saying nothing.
    expectedDelegates: optionalCount(1_000_000),
    heroImageUrl: optionalAssetUrlSchema.optional(),
    brochureUrl: optionalAssetUrlSchema.optional(),
    prospectusUrl: optionalAssetUrlSchema.optional(),
    isCurrent: checkboxSchema,
    isPublished: checkboxSchema,
    registrationOpen: checkboxSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'The end date cannot be before the start date.',
    path: ['endDate'],
  })

export const mediaCollectionSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(160),
  slug: slugSchema,
  kind: mediaKindSchema,
  description: optionalText(500),
  coverImageUrl: optionalAssetUrlSchema.optional(),
  sortOrder: sortOrderSchema,
  isPublished: checkboxSchema,
})

/**
 * One file in a collection.
 *
 * `kind` is absent on purpose: an asset takes the kind of the collection it
 * sits in. The public pages query on both — the gallery reads GALLERY assets of
 * the `forum-gallery` collection — so a photograph filed as a download in a
 * gallery would simply vanish, and the only way to make that unrepresentable is
 * not to ask twice.
 *
 * `mimeType` and `sizeBytes` are absent for the same reason: they are read from
 * the file itself in lib/actions/admin-media rather than typed.
 */
export const mediaAssetSchema = z.object({
  collectionId: z.string().min(1, 'Choose a collection.'),
  url: assetUrlSchema,
  title: optionalText(200),
  altText: optionalText(300),
  caption: optionalText(500),
  thumbnailUrl: optionalAssetUrlSchema.optional(),
  sortOrder: sortOrderSchema,
  isPublic: checkboxSchema,
})

export const trackSchema = z.object({
  eventId: z.string().min(1, 'Choose an event.'),
  name: z.string().trim().min(2, 'Enter a track name.').max(120),
  // A hex colour rather than a palette name: the value is rendered as an
  // inline swatch beside sessions on the agenda, so it has to be a colour the
  // browser understands, and `<input type="color">` submits exactly this form.
  colour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.')
    .default('#0F7A3D'),
  sortOrder: sortOrderSchema,
})

export const eventSessionSchema = z
  .object({
    eventId: z.string().min(1, 'Choose an event.'),
    trackId: optionalText(40),
    title: z.string().trim().min(3, 'Enter a session title.').max(300),
    slug: slugSchema,
    description: optionalText(10_000),
    // dayNumber is deliberately absent: it is derived from startsAt against
    // the event's own start date in lib/actions/admin-programme, because a day
    // number typed independently of the date is a day number that will one day
    // disagree with it — and the agenda's day tabs label themselves from the
    // date while grouping by the number, so the disagreement is visible.
    startsAt: utcDateTimeSchema,
    endsAt: utcDateTimeSchema,
    room: optionalText(120),
    sessionType: sessionTypeSchema.default(SessionType.PANEL),
    sortOrder: sortOrderSchema,
    isPublished: checkboxSchema,
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'A session must end after it starts.',
    path: ['endsAt'],
  })

/**
 * One speaker's place on one session.
 *
 * Assignment is its own small schema rather than an array folded into the
 * session form: a panel is built up a name at a time, and each addition is a
 * separate decision with its own role attached.
 */
export const sessionSpeakerSchema = z.object({
  sessionId: z.string().min(1, 'Choose a session.'),
  speakerId: z.string().min(1, 'Choose a speaker.'),
  role: speakerRoleSchema.default(SpeakerRole.SPEAKER),
})

export const speakerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the speaker's name.").max(200),
  slug: slugSchema,
  title: z.string().trim().min(2, 'Enter their job title.').max(200),
  organisation: z.string().trim().min(2, 'Enter their organisation.').max(200),
  bio: optionalText(5000),
  photoUrl: optionalUrlSchema.optional(),
  country: optionalText(80),
  sectorId: optionalText(40),
  linkedinUrl: optionalUrlSchema.optional(),
  twitterUrl: optionalUrlSchema.optional(),
  websiteUrl: optionalUrlSchema.optional(),
  sortOrder: sortOrderSchema,
  isFeatured: checkboxSchema,
  isPublished: checkboxSchema,
})

export const sponsorSchema = z.object({
  eventId: z.string().min(1, 'Choose an event.'),
  name: z.string().trim().min(2, 'Enter the sponsor name.').max(200),
  slug: slugSchema,
  tier: sponsorTierSchema.default(SponsorTier.SILVER),
  logoUrl: optionalUrlSchema.optional(),
  website: optionalUrlSchema.optional(),
  description: optionalText(2000),
  isPublished: checkboxSchema,
})

export const ticketTypeSchema = z
  .object({
    eventId: z.string().min(1, 'Choose an event.'),
    name: z.string().trim().min(2, 'Enter a ticket name.').max(200),
    slug: slugSchema,
    description: optionalText(1000),
    priceMinor: amountMinorSchema,
    currency: currencySchema.default('SLE'),
    priceMinorUSD: amountMinorSchema.optional(),
    capacity: z.coerce.number().int().min(0).max(1_000_000).optional(),
    salesStart: z.coerce.date().optional(),
    salesEnd: z.coerce.date().optional(),
    minQuantity: z.coerce.number().int().min(1).max(1000).default(1),
    maxQuantity: z.coerce.number().int().min(1).max(1000).default(10),
    isGroup: checkboxSchema,
    groupMinSize: z.coerce.number().int().min(2).max(1000).optional(),
    groupDiscountPercent: z.coerce.number().int().min(0).max(100).optional(),
    isActive: checkboxSchema,
  })
  .refine((data) => data.maxQuantity >= data.minQuantity, {
    message: 'The maximum cannot be below the minimum.',
    path: ['maxQuantity'],
  })

export const promoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'A promo code needs at least 3 characters.')
      .max(40)
      .toUpperCase()
      .regex(/^[A-Z0-9-]+$/, 'Use letters, numbers and hyphens only.'),
    label: optionalText(200),
    eventId: optionalText(40),
    ticketTypeId: optionalText(40),
    discountType: discountTypeSchema.default(DiscountType.PERCENT),
    discountValue: z.coerce
      .number()
      .int('Enter a whole number.')
      .min(1, 'Enter a discount greater than zero.'),
    maxRedemptions: z.coerce.number().int().min(1).max(1_000_000).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isActive: checkboxSchema,
  })
  .refine(
    (data) =>
      data.discountType !== DiscountType.PERCENT || data.discountValue <= 100,
    {
      message: 'A percentage discount cannot exceed 100.',
      path: ['discountValue'],
    },
  )

export const userAdminSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema.optional(),
  country: optionalText(80),
  role: roleSchema,
  isActive: checkboxSchema,
})

export const pageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2, 'Enter a page title.').max(200),
  bodyJson: z.string().default('{}'),
  metaTitle: optionalText(200),
  metaDescription: optionalText(300),
  status: contentStatusSchema.default(ContentStatus.PUBLISHED),
})

export const settingSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().max(10_000),
})

/** Manual reconciliation of an offline payment by the finance team. */
export const recordOfflinePaymentSchema = z.object({
  paymentId: z.string().min(1),
  status: paymentStatusSchema,
  note: optionalText(1000),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Field-keyed errors, shaped for rendering next to inputs. */
export type FieldErrors = Record<string, string>

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors }

/**
 * Parse FormData against a schema.
 *
 * Only the first error per field is kept — showing a delegate three complaints
 * about one input is noise, and the first is the one they can act on.
 */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): ParseResult<z.output<T>> {
  const raw: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue
    // Repeated keys (checkbox groups) collapse to an array.
    if (key in raw) {
      const existing = raw[key]
      raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    } else {
      raw[key] = value
    }
  }

  const result = schema.safeParse(raw)
  if (result.success) return { ok: true, data: result.data }

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '_form'
    if (!(field in errors)) errors[field] = issue.message
  }

  return { ok: false, errors }
}

/** Same, for `searchParams` objects. */
export function parseQuery<T extends z.ZodType>(
  schema: T,
  query: Record<string, string | string[] | undefined>,
): z.output<T> | null {
  const result = schema.safeParse(query)
  return result.success ? result.data : null
}
