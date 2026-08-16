/**
 * Status and role vocabularies.
 *
 * SQLite has no native enum type, so these columns are stored as `String`
 * (see the portability note in prisma/schema.prisma). This module is the single
 * source of truth for the permitted values: the const objects below are used
 * for writes, the derived union types for compile-time safety, and the
 * `zod` enums in src/lib/validation.ts for runtime validation at every entry
 * point. Nothing should ever write a bare string literal to one of these
 * columns.
 */

export const Role = {
  VISITOR: 'VISITOR',
  MEMBER: 'MEMBER',
  DELEGATE: 'DELEGATE',
  EDITOR: 'EDITOR',
  EVENT_MANAGER: 'EVENT_MANAGER',
  FINANCE: 'FINANCE',
  ADMIN: 'ADMIN',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const ROLE_LABELS: Record<Role, string> = {
  VISITOR: 'Visitor',
  MEMBER: 'Member',
  DELEGATE: 'Delegate',
  EDITOR: 'Editor',
  EVENT_MANAGER: 'Event manager',
  FINANCE: 'Finance',
  ADMIN: 'Administrator',
}

export const MemberStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus]

export const BusinessSize = {
  MICRO: 'MICRO',
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
} as const
export type BusinessSize = (typeof BusinessSize)[keyof typeof BusinessSize]

export const BUSINESS_SIZE_LABELS: Record<BusinessSize, string> = {
  MICRO: 'Micro (1–9 staff)',
  SMALL: 'Small (10–49 staff)',
  MEDIUM: 'Medium (50–249 staff)',
  LARGE: 'Large (250+ staff)',
}

export const SessionType = {
  KEYNOTE: 'KEYNOTE',
  PANEL: 'PANEL',
  ROUNDTABLE: 'ROUNDTABLE',
  WORKSHOP: 'WORKSHOP',
  PLENARY: 'PLENARY',
  NETWORKING: 'NETWORKING',
  BREAK: 'BREAK',
  CEREMONY: 'CEREMONY',
} as const
export type SessionType = (typeof SessionType)[keyof typeof SessionType]

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  KEYNOTE: 'Keynote',
  PANEL: 'Panel',
  ROUNDTABLE: 'Roundtable',
  WORKSHOP: 'Workshop',
  PLENARY: 'Plenary',
  NETWORKING: 'Networking',
  BREAK: 'Break',
  CEREMONY: 'Ceremony',
}

export const SpeakerRole = {
  SPEAKER: 'SPEAKER',
  MODERATOR: 'MODERATOR',
  CHAIR: 'CHAIR',
  PANELLIST: 'PANELLIST',
  KEYNOTE: 'KEYNOTE',
} as const
export type SpeakerRole = (typeof SpeakerRole)[keyof typeof SpeakerRole]

export const SponsorTier = {
  PLATINUM: 'PLATINUM',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  BRONZE: 'BRONZE',
  PARTNER: 'PARTNER',
  EXHIBITOR: 'EXHIBITOR',
} as const
export type SponsorTier = (typeof SponsorTier)[keyof typeof SponsorTier]

/** Display order for the tiered sponsor grid in §4.7. */
export const SPONSOR_TIER_ORDER: SponsorTier[] = [
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'PARTNER',
  'EXHIBITOR',
]

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  PARTNER: 'Partner',
  EXHIBITOR: 'Exhibitor',
}

export const RegistrationStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const
export type RegistrationStatus =
  (typeof RegistrationStatus)[keyof typeof RegistrationStatus]

export const PaymentMethod = {
  ORANGE_MONEY: 'ORANGE_MONEY',
  AFRIMONEY: 'AFRIMONEY',
  CARD: 'CARD',
  OFFLINE: 'OFFLINE',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ORANGE_MONEY: 'Orange Money',
  AFRIMONEY: 'Afrimoney',
  CARD: 'Debit / credit card',
  OFFLINE: 'Bank transfer or cash (invoice)',
}

export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PaymentPurpose = {
  EVENT_REGISTRATION: 'EVENT_REGISTRATION',
  MEMBERSHIP: 'MEMBERSHIP',
  SPONSORSHIP: 'SPONSORSHIP',
  OTHER: 'OTHER',
} as const
export type PaymentPurpose = (typeof PaymentPurpose)[keyof typeof PaymentPurpose]

export const InvoiceStatus = {
  ISSUED: 'ISSUED',
  PAID: 'PAID',
  VOID: 'VOID',
  OVERDUE: 'OVERDUE',
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

export const LedgerEntryType = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const
export type LedgerEntryType =
  (typeof LedgerEntryType)[keyof typeof LedgerEntryType]

export const DiscountType = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED',
} as const
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType]

export const OpportunityStage = {
  CONCEPT: 'CONCEPT',
  STARTUP: 'STARTUP',
  GROWTH: 'GROWTH',
  EXPANSION: 'EXPANSION',
  MATURE: 'MATURE',
} as const
export type OpportunityStage =
  (typeof OpportunityStage)[keyof typeof OpportunityStage]

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  CONCEPT: 'Concept',
  STARTUP: 'Start-up',
  GROWTH: 'Growth',
  EXPANSION: 'Expansion',
  MATURE: 'Mature',
}

export const OpportunityStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
} as const
export type OpportunityStatus =
  (typeof OpportunityStatus)[keyof typeof OpportunityStatus]

export const ApplicationStatus = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SHORTLISTED: 'SHORTLISTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus]

export const AccessRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
} as const
export type AccessRequestStatus =
  (typeof AccessRequestStatus)[keyof typeof AccessRequestStatus]

export const ContentStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus]

export const MediaKind = {
  GALLERY: 'GALLERY',
  VIDEO: 'VIDEO',
  DOWNLOAD: 'DOWNLOAD',
} as const
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind]

export const FormType = {
  CONTACT: 'CONTACT',
  SPONSOR_ENQUIRY: 'SPONSOR_ENQUIRY',
  EXHIBITOR_ENQUIRY: 'EXHIBITOR_ENQUIRY',
  MEMBERSHIP_ENQUIRY: 'MEMBERSHIP_ENQUIRY',
  GENERAL: 'GENERAL',
} as const
export type FormType = (typeof FormType)[keyof typeof FormType]

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  CONTACT: 'Contact',
  SPONSOR_ENQUIRY: 'Sponsorship enquiry',
  EXHIBITOR_ENQUIRY: 'Exhibitor enquiry',
  MEMBERSHIP_ENQUIRY: 'Membership enquiry',
  GENERAL: 'General',
}

export const SubmissionStatus = {
  NEW: 'NEW',
  READ: 'READ',
  RESPONDED: 'RESPONDED',
  ARCHIVED: 'ARCHIVED',
} as const
export type SubmissionStatus =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

export const MessageChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
} as const
export type MessageChannel = (typeof MessageChannel)[keyof typeof MessageChannel]

export const MessageStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SUPPRESSED: 'SUPPRESSED',
} as const
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus]

export const PartnerKind = {
  PARTNER: 'PARTNER',
  AFFILIATION: 'AFFILIATION',
  SUPPORTER: 'SUPPORTER',
} as const
export type PartnerKind = (typeof PartnerKind)[keyof typeof PartnerKind]

export const LeadershipGroup = {
  LEADERSHIP: 'LEADERSHIP',
  SECRETARIAT: 'SECRETARIAT',
  GOVERNANCE: 'GOVERNANCE',
} as const
export type LeadershipGroup =
  (typeof LeadershipGroup)[keyof typeof LeadershipGroup]

/** Regions used by directory and opportunity filters. */
export const SL_REGIONS = [
  'Western Area',
  'Northern Province',
  'North West Province',
  'Southern Province',
  'Eastern Province',
] as const
export type SLRegion = (typeof SL_REGIONS)[number]
