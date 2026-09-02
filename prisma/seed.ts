import 'dotenv/config'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

/**
 * Seed data for the Freetown Business Forum.
 *
 * This is not lorem ipsum. Every page in the SDR is driven from the database
 * (FR-01), so a half-filled database means a half-testable site: you cannot
 * tell whether the agenda accordion works until there are sessions with real
 * overlapping times, or whether the tier table wraps on a phone until it has
 * four tiers of genuine length. The copy below is plausible FBF content —
 * placeholder in the sense that the secretariat will rewrite it, not in the
 * sense that it is filler.
 *
 * Idempotent: every write is an upsert keyed on a natural key, so `npm run
 * db:seed` can be run repeatedly against a working database without
 * duplicating rows or clobbering local edits to unrelated tables.
 *
 * Dates are anchored to the event so the seed does not go stale — the forum is
 * always "next year" relative to whenever this is run.
 */

// No default connection string: seeding the wrong database is worse than not
// seeding one, and this script is run by hand against whichever DATABASE_URL
// is in the environment.
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

// ── Date helpers ────────────────────────────────────────────────────────────

const EVENT_YEAR = new Date().getFullYear() + 1

/** 10:30 on day N of the forum, in local time. */
function eventDay(day: number, hour: number, minute = 0): Date {
  // The forum runs 18–20 November.
  return new Date(EVENT_YEAR, 10, 17 + day, hour, minute, 0, 0)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

/** Money is always minor units — Le 2,500.00 is 250000. */
const le = (major: number) => Math.round(major * 100)
const usd = (major: number) => Math.round(major * 100)

async function main() {
  console.log(`Seeding FBF ${EVENT_YEAR}…`)

  // ── Site settings ─────────────────────────────────────────────────────────

  const settings: Array<{
    key: string
    value: string
    group: string
    label: string
    type: string
    sortOrder: number
  }> = [
    { key: 'site.name', value: 'Freetown Business Forum', group: 'general', label: 'Site name', type: 'TEXT', sortOrder: 1 },
    { key: 'site.tagline', value: 'Convening capital, government and enterprise for a prosperous Sierra Leone', group: 'general', label: 'Tagline', type: 'TEXT', sortOrder: 2 },
    { key: 'contact.email', value: 'freetownbusinessforum@gmail.com', group: 'contact', label: 'Public email', type: 'EMAIL', sortOrder: 10 },
    { key: 'contact.phone', value: '+232 75 768996', group: 'contact', label: 'Public phone', type: 'TEXT', sortOrder: 11 },
    // The forum publishes two numbers, not one. The second gets a key of its own
    // rather than being appended to `contact.phone`, because the footer and the
    // contact page build a `tel:` href by stripping spaces out of that value —
    // two numbers in one row would produce a link that dials neither.
    { key: 'contact.phoneAlt', value: '+232 88 819708', group: 'contact', label: 'Second public phone', type: 'TEXT', sortOrder: 12 },
    { key: 'contact.whatsapp', value: '', group: 'contact', label: 'WhatsApp number', type: 'TEXT', sortOrder: 13 },
    { key: 'contact.address', value: 'Freetown Business Forum, 12C Lumley Road, Freetown, Sierra Leone', group: 'contact', label: 'Postal address', type: 'TEXTAREA', sortOrder: 14 },
    { key: 'contact.mapUrl', value: 'https://maps.google.com/?q=12C+Lumley+Road+Freetown', group: 'contact', label: 'Map link', type: 'URL', sortOrder: 15 },
    { key: 'social.linkedin', value: '', group: 'social', label: 'LinkedIn', type: 'URL', sortOrder: 20 },
    { key: 'social.twitter', value: '', group: 'social', label: 'X / Twitter', type: 'URL', sortOrder: 21 },
    { key: 'social.facebook', value: '', group: 'social', label: 'Facebook', type: 'URL', sortOrder: 22 },
    { key: 'stats.delegates', value: '1200', group: 'homepage', label: 'Delegates (counter)', type: 'NUMBER', sortOrder: 30 },
    { key: 'stats.countries', value: '35', group: 'homepage', label: 'Countries represented', type: 'NUMBER', sortOrder: 31 },
    { key: 'stats.sectors', value: '8', group: 'homepage', label: 'Priority sectors', type: 'NUMBER', sortOrder: 32 },
    { key: 'stats.dealValue', value: '450', group: 'homepage', label: 'Deals facilitated (US$m)', type: 'NUMBER', sortOrder: 33 },
    { key: 'stats.members', value: '500+', group: 'homepage', label: 'Member organisations (membership page)', type: 'TEXT', sortOrder: 34 },
    { key: 'newsletter.blurb', value: 'Monthly briefings on investment opportunities, policy changes and forum news. No more than one email a month.', group: 'homepage', label: 'Newsletter blurb', type: 'TEXTAREA', sortOrder: 40 },
    // The hero stacks these three at display size and lights each one in the
    // accent as the cycle reaches it. Single words — at 88px a two-word line wraps and the stack loses
    // its shape. Comma-separated rather than JSON so the field stays editable
    // as a plain text input.
    { key: 'home.heroWords', value: 'Inspire,Excite,Motivate', group: 'homepage', label: 'Hero words (comma-separated, first 3 used)', type: 'TEXT', sortOrder: 41 },
    { key: 'home.heroStatement', value: 'Delivering ideas that', group: 'homepage', label: 'Hero lead-in (sits above the three words)', type: 'TEXT', sortOrder: 42 },
    // The statement band under the endorsements. One word of the heading is
    // set in bold against the rest at regular weight, and which word that is
    // is the copywriter's call, not the layout's — so the value carries the
    // mark itself: asterisks around the emphasised run.
    { key: 'home.introHeading', value: 'We *connect* Sierra Leonean enterprise with the world', group: 'homepage', label: 'Intro heading (wrap one word in *asterisks* to embolden it)', type: 'TEXT', sortOrder: 43 },
    { key: 'home.introBody', value: "The Freetown Business Forum brings investors, government and enterprise into one room. Our bi-annual forum, the national business directory and the Deal Room give members a standing route to capital, partners and policy — and give the world a way in to Sierra Leone's fastest-growing sectors.", group: 'homepage', label: 'Intro paragraph', type: 'TEXTAREA', sortOrder: 44 },
  ]

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { label: setting.label, group: setting.group, type: setting.type, sortOrder: setting.sortOrder },
      // `value` is intentionally not overwritten on update — staff edits in the
      // admin panel must survive a re-seed.
      create: setting,
    })
  }

  // ── Sectors ───────────────────────────────────────────────────────────────

  const sectorData = [
    {
      slug: 'agriculture',
      name: 'Agriculture & Agribusiness',
      iconKey: 'sprout',
      summary:
        'Cocoa, coffee, rice, oil palm and cashew — with processing and export value still largely uncaptured at home.',
      overview:
        'Agriculture employs around two thirds of Sierra Leone’s workforce and contributes close to a sixth of GDP, yet the majority of output leaves the country raw. The opportunity is in the middle of the chain: aggregation, processing, cold storage, certification and branded export. Sierra Leonean cocoa and cashew already command a premium where traceability can be demonstrated.',
      incentives:
        'Duty-free import of agricultural machinery; a three-year corporate income tax holiday for qualifying agro-processing investments; access to the Smallholder Commercialisation Programme for outgrower schemes.',
      dataJson: JSON.stringify([
        { label: 'Share of employment', value: '57%' },
        { label: 'Arable land uncultivated', value: '~65%' },
        { label: 'Cocoa exported raw', value: '90%+' },
      ]),
      sortOrder: 1,
    },
    {
      slug: 'mining',
      name: 'Mining & Minerals',
      iconKey: 'pickaxe',
      summary:
        'Rutile, bauxite, iron ore, diamonds and gold, with growing interest in critical minerals for the energy transition.',
      overview:
        'Sierra Leone holds one of the world’s largest natural rutile deposits alongside substantial bauxite, iron ore and alluvial diamond reserves. Policy attention has shifted from extraction volume to local beneficiation, community development agreements and environmental compliance under the Mines and Minerals Development Act.',
      incentives:
        'Stabilised fiscal terms under negotiated mining agreements; import duty relief on plant and machinery during the construction phase.',
      dataJson: JSON.stringify([
        { label: 'Share of exports', value: '~80%' },
        { label: 'Large-scale licences', value: '20+' },
        { label: 'Rutile reserves', value: 'World top 3' },
      ]),
      sortOrder: 2,
    },
    {
      slug: 'energy',
      name: 'Energy & Renewables',
      iconKey: 'zap',
      summary:
        'Grid expansion, mini-grids and utility-scale solar and hydro in a market where most of the country is still unserved.',
      overview:
        'National electrification stands well below the West African average, and demand from mining, agro-processing and a growing urban population is outpacing supply. The pipeline spans utility-scale solar, run-of-river hydro, distributed mini-grids for district towns, and transmission upgrades under the West African Power Pool.',
      incentives:
        'Feed-in arrangements for renewable generation; duty exemptions on solar equipment and components; guaranteed offtake under negotiated power purchase agreements.',
      dataJson: JSON.stringify([
        { label: 'National access rate', value: '~26%' },
        { label: 'Rural access rate', value: '~5%' },
        { label: 'Installed capacity', value: '~150 MW' },
      ]),
      sortOrder: 3,
    },
    {
      slug: 'tourism',
      name: 'Tourism & Hospitality',
      iconKey: 'palm',
      summary:
        'Peninsula beaches, Tiwai Island, Bunce Island and eco-lodges — an underbuilt sector with rising arrivals.',
      overview:
        'The Freetown Peninsula holds some of West Africa’s least developed beachfront, and the country’s heritage sites carry international significance. The constraint is not demand but rooms, routes and standards: the sector needs mid-market hotel stock, trained hospitality staff and reliable domestic connections.',
      incentives:
        'Tax holidays for new hotel construction above a qualifying threshold; duty relief on hospitality fittings and equipment; long leases available on designated tourism land.',
      dataJson: JSON.stringify([
        { label: 'Coastline', value: '400 km' },
        { label: 'Classified hotel rooms', value: '< 3,000' },
        { label: 'Annual arrivals', value: '~100,000' },
      ]),
      sortOrder: 4,
    },
    {
      slug: 'fintech',
      name: 'Fintech & Digital Economy',
      iconKey: 'smartphone',
      summary:
        'Mobile money, digital lending and payment rails serving a young, mobile-first, largely unbanked population.',
      overview:
        'Mobile money has done more for financial inclusion in five years than branch banking managed in fifty, and the rails it created are now carrying credit, insurance and merchant payments. Sierra Leone’s regulator operates a sandbox, and the National Digital Identity programme is opening the door to remote onboarding.',
      incentives:
        'Regulatory sandbox for licensed innovators; reduced duty on ICT equipment; national identity system integration for KYC.',
      dataJson: JSON.stringify([
        { label: 'Mobile money accounts', value: '4.5m+' },
        { label: 'Adults formally banked', value: '~20%' },
        { label: 'Under 35', value: '75% of people' },
      ]),
      sortOrder: 5,
    },
    {
      slug: 'infrastructure',
      name: 'Infrastructure & Transport',
      iconKey: 'road',
      summary:
        'Roads, the Freetown port corridor, logistics, housing and urban water — largely delivered as PPPs.',
      overview:
        'Freetown’s port is the natural gateway for the country and parts of its landlocked neighbours, and the corridors feeding it are the binding constraint on almost every other sector. Government appetite for public-private partnership is strong, with a dedicated PPP unit and a pipeline covering roads, housing, water and logistics.',
      incentives:
        'Concession terms negotiated through the PPP unit; guaranteed cost recovery on qualifying utility projects; access to blended finance from development partners.',
      dataJson: JSON.stringify([
        { label: 'Paved road network', value: '~1,000 km' },
        { label: 'Port throughput', value: 'Growing 8% p.a.' },
        { label: 'Urban housing deficit', value: '~500,000 units' },
      ]),
      sortOrder: 6,
    },
    {
      slug: 'fisheries',
      name: 'Fisheries & Blue Economy',
      iconKey: 'fish',
      summary:
        'One of West Africa’s richest fishing grounds, with processing and cold chain the missing link.',
      overview:
        'Sierra Leone’s continental shelf is among the most productive in the region, but the bulk of the catch is landed, iced and exported with almost no value added onshore. Investment in cold chain, processing plants and certified handling would keep margin — and jobs — in the country while improving stock management.',
      incentives:
        'Licensing support for industrial fishing and aquaculture; duty relief on cold chain and processing equipment.',
      dataJson: JSON.stringify([
        { label: 'Continental shelf', value: '30,000 km²' },
        { label: 'Sector employment', value: '~500,000' },
        { label: 'Catch processed locally', value: '< 15%' },
      ]),
      sortOrder: 7,
    },
    {
      slug: 'manufacturing',
      name: 'Manufacturing & Light Industry',
      iconKey: 'factory',
      summary:
        'Import substitution in construction materials, packaging, food and beverages, and consumer goods.',
      overview:
        'Sierra Leone imports a striking share of what it consumes, including goods whose raw inputs are produced domestically. Cement, packaging, processed foods and building materials all present import-substitution cases that improve with regional market access under the AfCFTA.',
      incentives:
        'Duty relief on capital equipment; industrial land through the Sierra Leone Investment and Export Promotion Agency; AfCFTA preferential access to the continental market.',
      dataJson: JSON.stringify([
        { label: 'Share of GDP', value: '~2%' },
        { label: 'Consumer goods imported', value: 'Majority' },
        { label: 'AfCFTA market', value: '1.3bn people' },
      ]),
      sortOrder: 8,
    },
  ]

  const sectors: Record<string, string> = {}
  for (const sector of sectorData) {
    const row = await prisma.sector.upsert({
      where: { slug: sector.slug },
      update: sector,
      create: sector,
    })
    sectors[sector.slug] = row.id
  }
  console.log(`  ✓ ${sectorData.length} sectors`)

  // ── Users ─────────────────────────────────────────────────────────────────

  // Seeded accounts share one weak password on purpose: they exist only in
  // development. Production is seeded with sectors and content only, and the
  // first administrator is created interactively.
  const devPassword = await bcrypt.hash('FBFdev2026!', 12)

  const staff = [
    { email: 'admin@fbf.sl', firstName: 'Aminata', lastName: 'Kamara', role: 'ADMIN', phone: '+232 76 100 001' },
    { email: 'editor@fbf.sl', firstName: 'Mohamed', lastName: 'Sesay', role: 'EDITOR', phone: '+232 76 100 002' },
    { email: 'events@fbf.sl', firstName: 'Fatmata', lastName: 'Bangura', role: 'EVENT_MANAGER', phone: '+232 76 100 003' },
    { email: 'finance@fbf.sl', firstName: 'Ibrahim', lastName: 'Conteh', role: 'FINANCE', phone: '+232 76 100 004' },
  ]

  const users: Record<string, string> = {}
  for (const person of staff) {
    const row = await prisma.user.upsert({
      where: { email: person.email },
      update: { role: person.role, isActive: true },
      create: {
        ...person,
        passwordHash: devPassword,
        emailVerified: true,
        country: 'Sierra Leone',
      },
    })
    users[person.email] = row.id
  }
  console.log(`  ✓ ${staff.length} staff accounts (password: FBFdev2026!)`)

  // ── Membership tiers ──────────────────────────────────────────────────────

  const tierData = [
    {
      slug: 'individual',
      name: 'Individual',
      strapline: 'For professionals, consultants and sole traders.',
      priceMinor: le(1_500),
      priceMinorUSD: usd(65),
      sortOrder: 1,
      featuresJson: JSON.stringify([
        'Named listing in the member directory',
        'Member rate on forum registration',
        'Monthly investment and policy briefing',
        'Access to member networking evenings',
      ]),
    },
    {
      slug: 'sme',
      name: 'SME',
      strapline: 'For businesses with fewer than 50 staff.',
      priceMinor: le(5_000),
      priceMinorUSD: usd(215),
      sortOrder: 2,
      featuresJson: JSON.stringify([
        'Full business profile in the directory',
        'Two member-rate forum registrations',
        'Submit propositions to the Deal Room',
        'Quarterly business clinic with sector advisers',
        'Monthly investment and policy briefing',
      ]),
    },
    {
      slug: 'corporate',
      name: 'Corporate',
      strapline: 'For established companies and institutions.',
      priceMinor: le(20_000),
      priceMinorUSD: usd(860),
      sortOrder: 3,
      featuresJson: JSON.stringify([
        'Featured directory profile with logo and gallery',
        'Five member-rate forum registrations',
        'Priority Deal Room listing and investor introductions',
        'Named invitation to policy roundtables',
        'Logo on the FBF partners page',
        'Quarterly business clinic with sector advisers',
      ]),
    },
    {
      slug: 'patron',
      name: 'Patron',
      strapline: 'For organisations underwriting the forum’s work.',
      priceMinor: le(75_000),
      priceMinorUSD: usd(3_200),
      sortOrder: 4,
      featuresJson: JSON.stringify([
        'Everything in Corporate',
        'Ten complimentary forum registrations',
        'Speaking slot consideration in the programme',
        'Seat at the annual government–private sector dialogue',
        'Patron recognition across forum materials',
        'Bespoke investor matchmaking with the secretariat',
      ]),
    },
  ]

  const tiers: Record<string, string> = {}
  for (const tier of tierData) {
    const row = await prisma.membershipTier.upsert({
      where: { slug: tier.slug },
      update: tier,
      create: tier,
    })
    tiers[tier.slug] = row.id
  }
  console.log(`  ✓ ${tierData.length} membership tiers`)

  // ── The forum ─────────────────────────────────────────────────────────────

  const event = await prisma.event.upsert({
    where: { slug: `fbf-${EVENT_YEAR}` },
    update: {},
    create: {
      slug: `fbf-${EVENT_YEAR}`,
      name: `Freetown Business Forum ${EVENT_YEAR}`,
      theme: 'Building the Next Economy: Capital, Capability and Connection',
      tagline:
        'Three days connecting Sierra Leonean enterprise with the capital and partnerships to scale it.',
      startDate: eventDay(1, 8, 30),
      endDate: eventDay(3, 17, 0),
      venueName: 'Bintumani Conference Centre',
      venueAddress: 'Aberdeen, Freetown',
      city: 'Freetown',
      country: 'Sierra Leone',
      venueMapUrl: 'https://maps.google.com/?q=Bintumani+Conference+Centre+Freetown',
      venueLat: 8.4855,
      venueLng: -13.2789,
      description:
        'The Freetown Business Forum is the country’s principal convening of investors, business leaders, government and development partners. Over three days in Freetown, delegates move from national strategy to signed transactions: plenaries set the policy direction, sector roundtables work through the practical barriers, and the Deal Room puts capital in the same room as the businesses seeking it.',
      objectivesJson: JSON.stringify([
        'Present a credible, evidenced investment case for Sierra Leone across eight priority sectors',
        'Connect domestic businesses with domestic, diaspora and international capital',
        'Surface the practical barriers to doing business and agree actions with government',
        'Build the capability of Sierra Leonean SMEs to become investment-ready',
        'Strengthen the standing relationship between the private sector and the state',
      ]),
      whoAttendsJson: JSON.stringify([
        'Institutional and private investors, DFIs and impact funds',
        'Sierra Leonean businesses and SMEs seeking growth capital',
        'Government ministries, agencies and regulators',
        'Development partners and multilateral institutions',
        'Diaspora investors and business networks',
        'Professional services, banking and legal advisers',
      ]),
      expectedDelegates: 1200,
      isCurrent: true,
      isPublished: true,
      registrationOpen: true,
    },
  })

  // Exactly one event may carry `isCurrent`. A database seeded under an earlier
  // event slug still holds that older row, and two current events make
  // getCurrentEvent()'s findFirst a coin toss for the header, hero and every
  // registration link.
  await prisma.event.updateMany({
    where: { id: { not: event.id }, isCurrent: true },
    data: { isCurrent: false },
  })
  console.log(`  ✓ event ${event.name}`)

  // ── Tracks ────────────────────────────────────────────────────────────────

  const trackData = [
    { name: 'Plenary', colour: '#0F7A3D', sortOrder: 1 },
    { name: 'Investment & Finance', colour: '#1D4F91', sortOrder: 2 },
    { name: 'Sector Deep Dives', colour: '#C8871B', sortOrder: 3 },
    { name: 'SME Capability', colour: '#4A7C59', sortOrder: 4 },
  ]

  const tracks: Record<string, string> = {}
  for (const track of trackData) {
    // Track has no natural unique key in the schema, so match on name + event.
    const existing = await prisma.track.findFirst({
      where: { eventId: event.id, name: track.name },
    })
    const row = existing
      ? await prisma.track.update({ where: { id: existing.id }, data: track })
      : await prisma.track.create({ data: { ...track, eventId: event.id } })
    tracks[track.name] = row.id
  }

  // ── Speakers ──────────────────────────────────────────────────────────────

  const speakerData = [
    { slug: 'ngozi-adeyemi', fullName: 'Dr Ngozi Adeyemi', title: 'Regional Director, West Africa', organisation: 'African Development Bank', country: 'Nigeria', sectorSlug: 'infrastructure', isFeatured: true, sortOrder: 3, bio: 'Oversees the Bank’s West African portfolio, with a focus on infrastructure finance and private sector operations in fragile and transition states.' },
    { slug: 'mariama-jalloh', fullName: 'Mariama Jalloh', title: 'Founder & Chief Executive', organisation: 'Salone Agro Processing', country: 'Sierra Leone', sectorSlug: 'agriculture', isFeatured: true, sortOrder: 4, bio: 'Built a cashew processing business from a single outgrower scheme in Kambia into a certified exporter working with more than 4,000 smallholder farmers.' },
    { slug: 'david-okonjo', fullName: 'David Okonjo', title: 'Managing Partner', organisation: 'Atlantic Frontier Capital', country: 'Ghana', sectorSlug: 'fintech', isFeatured: true, sortOrder: 5, bio: 'Invests growth capital in West African financial services and consumer businesses, with a portfolio spanning six markets.' },
    { slug: 'aisha-turay', fullName: 'Aisha Turay', title: 'Governor', organisation: 'Bank of Sierra Leone', country: 'Sierra Leone', sectorSlug: 'fintech', isFeatured: true, sortOrder: 6, bio: 'Responsible for monetary policy and financial sector supervision, including the regulatory sandbox for financial innovation.' },
    { slug: 'james-koroma', fullName: 'James Koroma', title: 'Chief Executive', organisation: 'Sierra Rutile', country: 'Sierra Leone', sectorSlug: 'mining', sortOrder: 7, bio: 'Runs one of the country’s largest mining operations and its associated community development programme.' },
    { slug: 'fatou-diallo', fullName: 'Fatou Diallo', title: 'Head of Africa Investments', organisation: 'Nordic Development Fund', country: 'Senegal', sectorSlug: 'energy', sortOrder: 8, bio: 'Structures concessional and blended finance for renewable energy and climate adaptation projects across West Africa.' },
    { slug: 'samuel-macarthy', fullName: 'Samuel Macarthy', title: 'Director General', organisation: 'Sierra Leone Investment and Export Promotion Agency', country: 'Sierra Leone', sectorSlug: 'manufacturing', sortOrder: 9, bio: 'Leads the national investment promotion agency and the one-stop shop for business registration and investor aftercare.' },
    { slug: 'grace-williams', fullName: 'Grace Williams', title: 'Chief Executive', organisation: 'Freetown Fisheries Cooperative', country: 'Sierra Leone', sectorSlug: 'fisheries', sortOrder: 10, bio: 'Represents more than 2,000 artisanal fishers and is building the country’s first cooperative-owned cold chain.' },
    { slug: 'olu-thompson', fullName: 'Olu Thompson', title: 'Partner', organisation: 'Diaspora Growth Partners', country: 'United Kingdom', sectorSlug: 'fintech', sortOrder: 11, bio: 'Channels diaspora capital into Sierra Leonean SMEs through a syndicate of British and American investors of Sierra Leonean heritage.' },
    { slug: 'hawa-sankoh', fullName: 'Hawa Sankoh', title: 'Managing Director', organisation: 'Peninsula Resorts', country: 'Sierra Leone', sectorSlug: 'tourism', sortOrder: 12, bio: 'Developed three eco-lodges on the Freetown Peninsula and chairs the national hospitality standards working group.' },
  ]

  // Two earlier rows named real, serving public officials as speakers, which
  // asserts an appearance nobody has agreed to. Removed here as well as from
  // the list above, so a database seeded before this still loses them.
  await prisma.speaker.deleteMany({
    where: { slug: { notIn: speakerData.map((speaker) => speaker.slug) } },
  })

  const speakers: Record<string, string> = {}
  for (const { sectorSlug, ...speaker } of speakerData) {
    const data = {
      ...speaker,
      sectorId: sectorSlug ? sectors[sectorSlug] : null,
      isPublished: true,
    }
    const row = await prisma.speaker.upsert({
      where: { slug: speaker.slug },
      update: data,
      create: data,
    })
    speakers[speaker.slug] = row.id
  }
  console.log(`  ✓ ${speakerData.length} speakers`)

  // ── Programme ─────────────────────────────────────────────────────────────

  const sessionData = [
    // Day 1
    { slug: 'registration-day-1', title: 'Registration & welcome coffee', day: 1, start: eventDay(1, 8, 0), end: eventDay(1, 9, 0), type: 'BREAK', track: 'Plenary', room: 'Main Foyer' },
    { slug: 'opening-ceremony', title: 'Opening ceremony', day: 1, start: eventDay(1, 9, 0), end: eventDay(1, 10, 30), type: 'CEREMONY', track: 'Plenary', room: 'Bintumani Hall', description: 'The forum opens with the national economic agenda and the fiscal and macroeconomic outlook for the year ahead. Speakers are confirmed by the secretariat ahead of each edition.' },
    { slug: 'state-of-the-economy', title: 'The state of the economy: where the growth will come from', day: 1, start: eventDay(1, 11, 0), end: eventDay(1, 12, 30), type: 'PLENARY', track: 'Plenary', room: 'Bintumani Hall', speakers: [['aisha-turay', 'PANELLIST'], ['ngozi-adeyemi', 'PANELLIST'], ['david-okonjo', 'MODERATOR']], description: 'A frank assessment of the macroeconomic picture — inflation, exchange rate stability, debt sustainability and the credit environment — and what each means for the cost and availability of capital to Sierra Leonean businesses.' },
    { slug: 'lunch-day-1', title: 'Networking lunch', day: 1, start: eventDay(1, 12, 30), end: eventDay(1, 14, 0), type: 'NETWORKING', track: 'Plenary', room: 'Garden Terrace' },
    { slug: 'financing-the-middle', title: 'Financing the missing middle', day: 1, start: eventDay(1, 14, 0), end: eventDay(1, 15, 30), type: 'PANEL', track: 'Investment & Finance', room: 'Lion Room', speakers: [['david-okonjo', 'PANELLIST'], ['olu-thompson', 'PANELLIST'], ['fatou-diallo', 'PANELLIST']], description: 'Businesses too large for microfinance and too small for private equity are where most Sierra Leonean employment sits — and where the financing gap is widest. Investors and lenders set out what they can actually fund, on what terms, and what makes a proposition bankable.' },
    { slug: 'agribusiness-value-chain', title: 'Agribusiness: keeping the value at home', day: 1, start: eventDay(1, 14, 0), end: eventDay(1, 15, 30), type: 'ROUNDTABLE', track: 'Sector Deep Dives', room: 'Cotton Tree Room', speakers: [['mariama-jalloh', 'CHAIR']], description: 'Ninety per cent of Sierra Leonean cocoa leaves the country raw. This roundtable works through the specific constraints on processing — power, certification, working capital and offtake — and what would have to change for each.' },
    { slug: 'investment-ready', title: 'Getting investment-ready: what investors actually read', day: 1, start: eventDay(1, 16, 0), end: eventDay(1, 17, 30), type: 'WORKSHOP', track: 'SME Capability', room: 'Aberdeen Suite', speakers: [['olu-thompson', 'SPEAKER']], description: 'A working session for businesses preparing to raise. Financial records, governance, the shape of a usable data room, and the questions that end conversations early.' },
    { slug: 'welcome-reception', title: 'Welcome reception', day: 1, start: eventDay(1, 18, 30), end: eventDay(1, 21, 0), type: 'NETWORKING', track: 'Plenary', room: 'Garden Terrace' },

    // Day 2
    { slug: 'deal-room-opens', title: 'Deal Room opens', day: 2, start: eventDay(2, 8, 30), end: eventDay(2, 17, 0), type: 'NETWORKING', track: 'Investment & Finance', room: 'Deal Room', description: 'Scheduled one-to-one meetings between businesses and investors, matched in advance by the secretariat. Slots are booked through the delegate portal.' },
    { slug: 'energy-plenary', title: 'Powering growth: the energy investment pipeline', day: 2, start: eventDay(2, 9, 0), end: eventDay(2, 10, 30), type: 'PLENARY', track: 'Plenary', room: 'Bintumani Hall', speakers: [['fatou-diallo', 'PANELLIST'], ['ngozi-adeyemi', 'PANELLIST']], description: 'Utility-scale generation, mini-grids and transmission: the projects seeking capital, the tariff and offtake structures on offer, and how the West African Power Pool changes the arithmetic.' },
    { slug: 'mining-beneficiation', title: 'Mining: from extraction to beneficiation', day: 2, start: eventDay(2, 11, 0), end: eventDay(2, 12, 30), type: 'PANEL', track: 'Sector Deep Dives', room: 'Lion Room', speakers: [['james-koroma', 'PANELLIST'], ['samuel-macarthy', 'PANELLIST']], description: 'Critical minerals have made Sierra Leone’s deposits strategically interesting again. The panel examines what it would take to process more of them domestically, and how community development agreements are working in practice.' },
    { slug: 'fintech-rails', title: 'The rails beneath everything: fintech and financial inclusion', day: 2, start: eventDay(2, 11, 0), end: eventDay(2, 12, 30), type: 'PANEL', track: 'Investment & Finance', room: 'Cotton Tree Room', speakers: [['aisha-turay', 'PANELLIST'], ['david-okonjo', 'PANELLIST']], description: 'Mobile money reached people that branch banking never did. The panel looks at what the rails now enable — credit scoring, merchant payments, insurance — and how the sandbox and digital identity programme are shaping what can be built.' },
    { slug: 'lunch-day-2', title: 'Networking lunch', day: 2, start: eventDay(2, 12, 30), end: eventDay(2, 14, 0), type: 'NETWORKING', track: 'Plenary', room: 'Garden Terrace' },
    { slug: 'tourism-roundtable', title: 'Tourism: building the room stock', day: 2, start: eventDay(2, 14, 0), end: eventDay(2, 15, 30), type: 'ROUNDTABLE', track: 'Sector Deep Dives', room: 'Aberdeen Suite', speakers: [['hawa-sankoh', 'CHAIR']], description: 'The Peninsula has the beaches and not the beds. A working discussion on hotel development economics, land tenure, air access and the standards regime.' },
    { slug: 'diaspora-capital', title: 'Diaspora capital: beyond remittances', day: 2, start: eventDay(2, 14, 0), end: eventDay(2, 15, 30), type: 'PANEL', track: 'Investment & Finance', room: 'Lion Room', speakers: [['olu-thompson', 'PANELLIST'], ['mariama-jalloh', 'PANELLIST']], description: 'Remittances dwarf foreign direct investment, but almost none of it reaches Sierra Leonean businesses as equity. The panel examines the vehicles, the trust deficit, and what has worked elsewhere.' },
    { slug: 'blue-economy', title: 'The blue economy: fisheries, cold chain and certification', day: 2, start: eventDay(2, 16, 0), end: eventDay(2, 17, 30), type: 'ROUNDTABLE', track: 'Sector Deep Dives', room: 'Cotton Tree Room', speakers: [['grace-williams', 'CHAIR']], description: 'One of West Africa’s richest fishing grounds lands most of its catch for export with no processing. This session works through the cold chain, certification and financing that would change that.' },
    { slug: 'gala-dinner', title: 'Forum gala dinner and business awards', day: 2, start: eventDay(2, 19, 0), end: eventDay(2, 22, 30), type: 'CEREMONY', track: 'Plenary', room: 'Bintumani Hall' },

    // Day 3
    { slug: 'doing-business-clinic', title: 'Doing business in Sierra Leone: the practical clinic', day: 3, start: eventDay(3, 9, 0), end: eventDay(3, 10, 30), type: 'WORKSHOP', track: 'SME Capability', room: 'Aberdeen Suite', speakers: [['samuel-macarthy', 'SPEAKER']], description: 'Registration, licensing, tax, land title and work permits — walked through step by step by the agencies that issue them, with time for individual questions.' },
    { slug: 'infrastructure-ppp', title: 'Infrastructure and the PPP pipeline', day: 3, start: eventDay(3, 9, 0), end: eventDay(3, 10, 30), type: 'PANEL', track: 'Sector Deep Dives', room: 'Lion Room', speakers: [['ngozi-adeyemi', 'PANELLIST']], description: 'Roads, port, housing and urban water. The projects in the pipeline, the concession terms available, and how risk is being allocated between the state and private partners.' },
    { slug: 'sme-pitch', title: 'SME pitch showcase', day: 3, start: eventDay(3, 11, 0), end: eventDay(3, 12, 30), type: 'PLENARY', track: 'SME Capability', room: 'Bintumani Hall', speakers: [['mariama-jalloh', 'PANELLIST'], ['david-okonjo', 'PANELLIST'], ['olu-thompson', 'PANELLIST']], description: 'Twelve Sierra Leonean businesses, shortlisted from the Deal Room submissions, pitch to a panel of investors in front of the full forum.' },
    { slug: 'closing-plenary', title: 'Closing plenary: commitments and next steps', day: 3, start: eventDay(3, 14, 0), end: eventDay(3, 15, 30), type: 'PLENARY', track: 'Plenary', room: 'Bintumani Hall', speakers: [['samuel-macarthy', 'SPEAKER']], description: 'Government and the private sector set out what each has committed to during the forum, with named owners and dates, to be reported against at next year’s convening.' },
  ]

  for (const session of sessionData) {
    const { slug, title, day, start, end, type, track, room, description, speakers: sessionSpeakers } = session

    const data = {
      eventId: event.id,
      trackId: tracks[track] ?? null,
      title,
      description: description ?? null,
      dayNumber: day,
      startsAt: start,
      endsAt: end,
      room: room ?? null,
      sessionType: type,
      isPublished: true,
    }

    const row = await prisma.eventSession.upsert({
      where: { eventId_slug: { eventId: event.id, slug } },
      update: data,
      create: { ...data, slug },
    })

    if (sessionSpeakers) {
      for (const [speakerSlug, role] of sessionSpeakers as [string, string][]) {
        await prisma.sessionSpeaker.upsert({
          where: {
            sessionId_speakerId: {
              sessionId: row.id,
              speakerId: speakers[speakerSlug],
            },
          },
          update: { role },
          create: {
            sessionId: row.id,
            speakerId: speakers[speakerSlug],
            role,
          },
        })
      }
    }
  }
  console.log(`  ✓ ${sessionData.length} programme sessions`)

  // ── Ticket types ──────────────────────────────────────────────────────────

  const ticketData = [
    {
      slug: 'standard',
      name: 'Standard delegate',
      description: 'Full access to all three days, the exhibition, lunches and the welcome reception.',
      priceMinor: le(3_500),
      priceMinorUSD: usd(150),
      capacity: 800,
      maxQuantity: 10,
      sortOrder: 1,
    },
    {
      slug: 'member',
      name: 'FBF member',
      description: 'The standard delegate pass at the member rate. Available to members in good standing.',
      priceMinor: le(2_450),
      priceMinorUSD: usd(105),
      capacity: 300,
      maxQuantity: 10,
      sortOrder: 2,
    },
    {
      slug: 'sme',
      name: 'SME & start-up',
      description: 'Discounted rate for businesses with fewer than 50 staff. Proof of registration is checked at the desk.',
      priceMinor: le(1_750),
      priceMinorUSD: usd(75),
      capacity: 250,
      maxQuantity: 5,
      sortOrder: 3,
    },
    {
      slug: 'group',
      name: 'Corporate group (5+)',
      description: 'Five or more delegates from one organisation, with an automatic group discount.',
      priceMinor: le(3_500),
      priceMinorUSD: usd(150),
      capacity: 200,
      minQuantity: 5,
      maxQuantity: 50,
      isGroup: true,
      groupMinSize: 5,
      groupDiscountPercent: 15,
      sortOrder: 4,
    },
    {
      slug: 'student',
      name: 'Student & young professional',
      description: 'For full-time students and delegates under 30. Identification is checked at the desk.',
      priceMinor: le(500),
      priceMinorUSD: usd(25),
      capacity: 150,
      maxQuantity: 2,
      sortOrder: 5,
    },
    {
      slug: 'exhibitor',
      name: 'Exhibition stand',
      description: 'A 3m × 2m stand in the exhibition hall for all three days, including two delegate passes.',
      priceMinor: le(25_000),
      priceMinorUSD: usd(1_075),
      capacity: 60,
      maxQuantity: 3,
      sortOrder: 6,
    },
  ]

  for (const ticket of ticketData) {
    const data = {
      eventId: event.id,
      ...ticket,
      currency: 'SLE',
      salesEnd: eventDay(1, 0, 0),
      isActive: true,
    }
    await prisma.ticketType.upsert({
      where: { eventId_slug: { eventId: event.id, slug: ticket.slug } },
      update: data,
      create: data,
    })
  }
  console.log(`  ✓ ${ticketData.length} ticket types`)

  // ── Promo codes ───────────────────────────────────────────────────────────

  const promoData = [
    { code: 'EARLYBIRD', label: 'Early bird — 20% off, closes eight weeks out', discountType: 'PERCENT', discountValue: 20, maxRedemptions: 300, validUntil: eventDay(-56, 23, 59) },
    { code: 'DIASPORA10', label: 'Diaspora network — 10% off', discountType: 'PERCENT', discountValue: 10, maxRedemptions: 200 },
    { code: 'PARTNER500', label: 'Partner organisations — Le 500 off', discountType: 'FIXED', discountValue: le(500), maxRedemptions: 100 },
  ]

  for (const promo of promoData) {
    const data = { ...promo, eventId: event.id, isActive: true }
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: data,
      create: data,
    })
  }

  // ── Sponsors ──────────────────────────────────────────────────────────────

  const sponsorData = [
    { slug: 'african-development-bank', name: 'African Development Bank', tier: 'PLATINUM', website: 'https://www.afdb.org', description: 'Lead financing partner for the forum’s infrastructure and energy programme.', sortOrder: 1 },
    { slug: 'sierra-rutile', name: 'Sierra Rutile', tier: 'PLATINUM', website: 'https://www.sierra-rutile.com', description: 'One of the country’s largest mining operations and a long-standing forum patron.', sortOrder: 2 },
    { slug: 'rokel-commercial-bank', name: 'Rokel Commercial Bank', tier: 'GOLD', description: 'Official banking partner, supporting the SME capability programme.', sortOrder: 3 },
    { slug: 'orange-sierra-leone', name: 'Orange Sierra Leone', tier: 'GOLD', description: 'Connectivity and mobile money partner for the forum.', sortOrder: 4 },
    { slug: 'africell', name: 'Africell', tier: 'GOLD', description: 'Digital economy partner supporting the fintech track.', sortOrder: 5 },
    { slug: 'sierra-leone-brewery', name: 'Sierra Leone Brewery', tier: 'SILVER', description: 'Manufacturing sector partner and host of the welcome reception.', sortOrder: 6 },
    { slug: 'leocem', name: 'Leocem', tier: 'SILVER', description: 'Construction materials partner.', sortOrder: 7 },
    { slug: 'united-nations-development-programme', name: 'UNDP Sierra Leone', tier: 'PARTNER', website: 'https://www.undp.org', description: 'Development partner supporting the SME investment-readiness programme.', sortOrder: 8 },
    { slug: 'invest-salone', name: 'Invest Salone', tier: 'PARTNER', description: 'Trade and investment programme partner.', sortOrder: 9 },
    { slug: 'seaboard-west-africa', name: 'Seaboard West Africa', tier: 'BRONZE', description: 'Agribusiness and logistics partner.', sortOrder: 10 },
  ]

  for (const sponsor of sponsorData) {
    const data = { eventId: event.id, ...sponsor, isPublished: true }
    await prisma.sponsor.upsert({
      where: { eventId_slug: { eventId: event.id, slug: sponsor.slug } },
      update: data,
      create: data,
    })
  }
  console.log(`  ✓ ${sponsorData.length} sponsors`)

  // ── Partners, leadership ──────────────────────────────────────────────────

  const partnerData = [
    { slug: 'ministry-of-trade-and-industry', name: 'Ministry of Trade and Industry', kind: 'PARTNER', description: 'Convening ministry for the forum.', sortOrder: 1 },
    { slug: 'sliepa', name: 'Sierra Leone Investment and Export Promotion Agency', kind: 'PARTNER', description: 'National investment promotion agency and one-stop shop for investors.', sortOrder: 2 },
    { slug: 'bank-of-sierra-leone', name: 'Bank of Sierra Leone', kind: 'PARTNER', description: 'Central bank and financial sector regulator.', sortOrder: 3 },
    { slug: 'sl-chamber-of-commerce', name: 'Sierra Leone Chamber of Commerce, Industry and Agriculture', kind: 'AFFILIATION', description: 'The national chamber, representing business across all sectors.', sortOrder: 4 },
    { slug: 'ecowas', name: 'ECOWAS', kind: 'AFFILIATION', description: 'Regional economic community and trade integration partner.', sortOrder: 5 },
    { slug: 'world-bank-group', name: 'World Bank Group', kind: 'SUPPORTER', description: 'Supports the doing-business reform programme.', sortOrder: 6 },
    { slug: 'ifc', name: 'International Finance Corporation', kind: 'SUPPORTER', description: 'Private sector arm of the World Bank Group.', sortOrder: 7 },
  ]

  for (const partner of partnerData) {
    await prisma.partner.upsert({
      where: { slug: partner.slug },
      update: { ...partner, isPublished: true },
      create: { ...partner, isPublished: true },
    })
  }

  // The forum's officers, from the FBF information sheet supplied by the client.
  // No bios or individual email addresses: none were provided, and inventing
  // them for named, real people is not a placeholder — it is a false statement
  // about someone. The admin panel is where the secretariat adds their own.
  const leadershipData = [
    { slug: 'president-james-mallah', name: 'Dr. James Mohammed Mallah', role: 'President', group: 'LEADERSHIP', sortOrder: 1 },
    { slug: 'board-chairman-patrick-gibrilla', name: 'Hon. Patrick Michaelson Gibrilla', role: 'Board Chairman', group: 'LEADERSHIP', sortOrder: 2 },
    { slug: 'director-admin-programmes-sulaiman-sesay', name: 'Sulaiman Keh Sesay', role: 'Director of Admin and Programs', group: 'SECRETARIAT', sortOrder: 3 },
  ]

  // Upserts alone would leave earlier placeholder officers behind in a database
  // that has already been seeded, so anything not on the list above goes.
  await prisma.leadershipProfile.deleteMany({
    where: { slug: { notIn: leadershipData.map((profile) => profile.slug) } },
  })

  for (const profile of leadershipData) {
    await prisma.leadershipProfile.upsert({
      where: { slug: profile.slug },
      update: { ...profile, isPublished: true },
      create: { ...profile, isPublished: true },
    })
  }

  // ── Our story (About page timeline, §4.3) ─────────────────────────────────

  // One row, because one is what the source material supports: the FBF
  // information sheet gives the founding date and nothing else about the
  // forum's history. An invented timeline reads as institutional history to
  // every visitor, so the rest is for the secretariat to add through the admin
  // panel from what actually happened.
  //
  // `imageUrl` is left null: the brief calls for authentic Sierra Leonean
  // photography (§3.4) and the image library is not yet licensed, so the page
  // renders its own placeholder panel rather than a stock photograph. Setting
  // `imageUrl` on a row swaps it in.
  const milestoneData = [
    {
      slug: 'story-founded-2023',
      year: '2023',
      title: 'The forum is founded',
      body: 'The Freetown Business Forum is founded on 12 December 2023 as a non-profit organisation dedicated to empowering Sierra Leone’s business community — promoting small and medium enterprises, advancing trade and industries, supporting youth entrepreneurship, tourism and ecological protection, and strengthening human capital.',
      sortOrder: 1,
    },
  ]

  // Removes the placeholder timeline from any database seeded before the
  // forum's real history was known.
  await prisma.milestone.deleteMany({
    where: { slug: { notIn: milestoneData.map((milestone) => milestone.slug) } },
  })

  for (const milestone of milestoneData) {
    await prisma.milestone.upsert({
      where: { slug: milestone.slug },
      update: { ...milestone, isPublished: true },
      create: { ...milestone, isPublished: true },
    })
  }
  console.log(`  ✓ ${milestoneData.length} story milestones`)

  // ── News ──────────────────────────────────────────────────────────────────

  const categoryData = [
    { slug: 'forum-news', name: 'Forum news', description: 'Announcements about the forum and its programme.', sortOrder: 1 },
    { slug: 'investment', name: 'Investment', description: 'Deals, capital flows and investor activity.', sortOrder: 2 },
    { slug: 'policy', name: 'Policy & reform', description: 'Regulation, incentives and the business environment.', sortOrder: 3 },
    { slug: 'member-stories', name: 'Member stories', description: 'Sierra Leonean businesses in their own words.', sortOrder: 4 },
  ]

  const categories: Record<string, string> = {}
  for (const category of categoryData) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    })
    categories[category.slug] = row.id
  }

  const articleData = [
    {
      slug: `fbf-${EVENT_YEAR}-registration-opens`,
      title: `Registration opens for the Freetown Business Forum ${EVENT_YEAR}`,
      category: 'forum-news',
      isFeatured: true,
      publishedAt: daysAgo(3),
      excerpt: `Delegate registration for the ${EVENT_YEAR} forum is now open, with early-bird rates available until eight weeks before the event.`,
      body: `Registration for the Freetown Business Forum ${EVENT_YEAR} opened this week, with the secretariat expecting more than 1,200 delegates across the three days at the Bintumani Conference Centre in Freetown.

This year's theme, *Building the Next Economy: Capital, Capability and Connection*, reflects a deliberate shift in the forum's focus. "We have spent years making the case for Sierra Leone," said Aminata Kamara, Executive Director of the secretariat. "The case is made. What businesses tell us they need now is the capital to act on it, and the capability to be ready when it arrives."

The programme has been restructured around that shift. Alongside the plenaries and sector deep dives, a full track is given over to SME capability — investment readiness, financial record-keeping, governance and the practical mechanics of raising money. The Deal Room, which runs throughout the second day, matches businesses with investors in scheduled one-to-one meetings arranged in advance by the secretariat.

Early-bird registration carries a 20 per cent discount and closes eight weeks before the forum. Member, SME and student rates are available, and organisations booking five or more delegates receive an automatic group discount.

Registration is available through the forum website, with payment by Orange Money, Afrimoney, card, or bank transfer against an invoice.`,
    },
    {
      slug: 'deal-room-record-year',
      title: 'Deal Room facilitated US$45m in commitments at the last forum',
      category: 'investment',
      isFeatured: true,
      publishedAt: daysAgo(18),
      excerpt: 'An independent review of the Deal Room finds that a third of matched meetings led to a second conversation, and eleven transactions closed within the year.',
      body: `An independent review of the last forum's Deal Room has found that US$45m in investment commitments were made to Sierra Leonean businesses in the twelve months following the event, across eleven closed transactions.

The review, commissioned by the secretariat and carried out by an external evaluator, tracked all 214 matched meetings held over the two days of the Deal Room. Roughly a third progressed to a second conversation, and eleven reached financial close within the year — a conversion rate the evaluator described as "at the upper end of what comparable convenings achieve."

Agribusiness accounted for the largest share by number of transactions, with energy taking the largest share by value. Two of the eleven closed deals involved diaspora syndicates, a route the secretariat has been working to formalise.

The review was not uncritical. It found that businesses arriving without audited accounts or a coherent use-of-funds statement rarely progressed past the first meeting, regardless of the underlying quality of the business. That finding has directly shaped this year's programme, which adds a full SME capability track and requires Deal Room applicants to complete an investment-readiness assessment before they are matched.

"The meetings are not the constraint," the evaluator noted. "Readiness is."`,
    },
    {
      slug: 'new-investment-incentives-agro-processing',
      title: 'Government confirms extended tax relief for agro-processing',
      category: 'policy',
      publishedAt: daysAgo(31),
      excerpt: 'Qualifying agro-processing investments will receive a three-year corporate income tax holiday, with duty-free import of processing equipment.',
      body: `The Ministry of Finance has confirmed that qualifying agro-processing investments will attract a three-year corporate income tax holiday, alongside duty-free importation of processing and cold chain equipment.

The measure is aimed squarely at the gap between what Sierra Leone grows and what it exports. Around 90 per cent of the country's cocoa leaves as raw beans, and comparable proportions hold across cashew, oil palm and coffee. The value added between the farm gate and the shelf is captured almost entirely outside the country.

To qualify, an investment must exceed a minimum threshold, demonstrate a domestic sourcing commitment, and register with the Sierra Leone Investment and Export Promotion Agency before construction begins. The relief runs from the first year of commercial production rather than from incorporation — a change from the previous regime, which businesses had argued penalised projects with long build periods.

The measure will be discussed in detail at the agribusiness roundtable during the forum, with officials from the ministry and the agency present to take questions.`,
    },
    {
      slug: 'salone-agro-processing-cashew-story',
      title: 'From one outgrower scheme to 4,000 farmers: the Salone Agro story',
      category: 'member-stories',
      publishedAt: daysAgo(45),
      excerpt: 'Mariama Jalloh built a certified cashew exporter from a single scheme in Kambia. She is candid about what nearly stopped it.',
      body: `Mariama Jalloh started with one outgrower scheme in Kambia and a shipping container she had converted into a drying room. Salone Agro Processing now works with more than 4,000 smallholder farmers and holds the certifications required to sell into the European market directly.

She is candid about the years in between. "Everyone talks about market access as though that is the hard part," she says. "The hard part was working capital. Cashew is seasonal. You buy the whole crop in a window of about six weeks, and then you hold it, process it and sell it over the following ten months. No bank in this country wanted to lend against a warehouse full of nuts."

The business was funded, in the end, by a combination of retained earnings, a diaspora syndicate assembled through a family connection in London, and eventually a development finance facility that understood seasonal working capital. The certification — which took two years and required rebuilding the processing floor twice — came afterwards.

Jalloh chairs the agribusiness roundtable at this year's forum. Asked what she would say to a business starting where she started, she does not hesitate: "Get your records in order before you need them. When the money finally becomes available, it moves fast, and it will not wait while you reconstruct three years of accounts."`,
    },
    {
      slug: 'energy-pipeline-briefing',
      title: 'Three utility-scale solar projects reach financial close',
      category: 'investment',
      publishedAt: daysAgo(58),
      excerpt: 'A combined 120MW of generation capacity has reached financial close, with construction beginning before the end of the year.',
      body: `Three utility-scale solar projects with a combined capacity of 120MW have reached financial close, in what the Ministry of Energy has described as the largest single addition to the national generation pipeline in a decade.

The projects are backed by a mix of development finance and private equity, with power purchase agreements signed against the national utility. Construction is expected to begin before the end of the year, with first power targeted within eighteen months.

National electrification remains at around 26 per cent, and under 5 per cent in rural areas. Demand from mining, agro-processing and a rapidly urbanising population has been outpacing supply for several years, and the shortfall is consistently named by investors as among the most binding constraints on industrial investment.

The energy plenary on the second day of the forum will examine the remaining pipeline, including distributed mini-grids for district towns and the transmission upgrades required under the West African Power Pool.`,
    },
    {
      slug: 'membership-passes-500',
      title: 'FBF membership passes 500 organisations',
      category: 'forum-news',
      publishedAt: daysAgo(72),
      excerpt: 'The forum’s membership has grown past 500 organisations, with SMEs now the largest single tier.',
      body: `FBF membership has passed 500 organisations for the first time, with small and medium enterprises now accounting for the largest single tier.

The growth reflects a deliberate widening of the membership base. When the forum was founded, membership was dominated by large corporates and institutions. The introduction of the SME and individual tiers, at price points designed to be reachable by a growing business, has changed the composition substantially.

"A forum that only convenes people who are already at the table is not doing very much," said the Executive Director. "The businesses that most need the connections are the ones least able to afford them. The tiers exist to fix that."

Members receive a listing in the business directory, member rates on forum registration, access to the Deal Room, and the monthly investment and policy briefing. The directory is searchable by sector, region and business size, and is used by investors and procurement teams as a route into the Sierra Leonean market.`,
    },
  ]

  for (const article of articleData) {
    const { category, ...rest } = article
    const data = {
      ...rest,
      categoryId: categories[category],
      authorId: users['editor@fbf.sl'],
      status: 'PUBLISHED',
      isFeatured: article.isFeatured ?? false,
    }
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: data,
      create: data,
    })
  }
  console.log(`  ✓ ${articleData.length} articles`)

  // ── Members & directory ───────────────────────────────────────────────────

  const memberData = [
    { email: 'mariama@saloneagro.sl', firstName: 'Mariama', lastName: 'Jalloh', org: 'Salone Agro Processing', tier: 'corporate', sector: 'agriculture', region: 'North West Province', size: 'MEDIUM', memberNo: 'FBF-M-26-A001', featured: true, description: 'Certified cashew and cocoa processor working with more than 4,000 smallholder farmers across Kambia and Port Loko districts.', full: 'Salone Agro Processing buys, processes and exports cashew and cocoa under organic and Fairtrade certification. The company operates two processing facilities and an outgrower network covering more than 4,000 smallholder farmers, providing inputs, training and a guaranteed floor price. Exports go primarily to the European market, with a growing share sold under the company’s own brand rather than as a white-label input.', employees: 180, founded: 2014, website: 'https://saloneagro.sl' },
    { email: 'contact@peninsularesorts.sl', firstName: 'Hawa', lastName: 'Sankoh', org: 'Peninsula Resorts', tier: 'corporate', sector: 'tourism', region: 'Western Area', size: 'MEDIUM', memberNo: 'FBF-M-26-A002', featured: true, description: 'Three eco-lodges on the Freetown Peninsula, built and operated to international environmental standards.', full: 'Peninsula Resorts develops and operates small-footprint eco-lodges on the Freetown Peninsula, with a combined 84 rooms across three properties. The company trains its own hospitality staff through a partnership with the national hotel school and sources the large majority of its food supply within 50km of its properties.', employees: 120, founded: 2016, website: 'https://peninsularesorts.sl' },
    { email: 'info@freetownfisheries.sl', firstName: 'Grace', lastName: 'Williams', org: 'Freetown Fisheries Cooperative', tier: 'sme', sector: 'fisheries', region: 'Western Area', size: 'MEDIUM', memberNo: 'FBF-M-26-A003', description: 'A cooperative of more than 2,000 artisanal fishers building Sierra Leone’s first cooperative-owned cold chain.', full: 'Freetown Fisheries Cooperative aggregates the catch of more than 2,000 artisanal fishers, providing ice, storage and a route to market that removes several layers of intermediary. The cooperative is currently building its first cooperative-owned cold storage facility, which will allow members to hold catch rather than sell at whatever price is available on the day of landing.', employees: 45, founded: 2018 },
    { email: 'hello@kroobay-tech.sl', firstName: 'Abu', lastName: 'Kargbo', org: 'Kroo Bay Technologies', tier: 'sme', sector: 'fintech', region: 'Western Area', size: 'SMALL', memberNo: 'FBF-M-26-A004', featured: true, description: 'Merchant payment and inventory software for small retailers, built for intermittent connectivity.', full: 'Kroo Bay Technologies builds point-of-sale and inventory software for small retailers, designed to work offline and reconcile when a connection is available. The product integrates with the major mobile money providers and is used by more than 3,000 merchants across Freetown, Bo and Kenema.', employees: 24, founded: 2020, website: 'https://kroobay.tech' },
    { email: 'admin@leonebuilders.sl', firstName: 'Sorie', lastName: 'Kanu', org: 'Leone Builders', tier: 'sme', sector: 'infrastructure', region: 'Western Area', size: 'MEDIUM', memberNo: 'FBF-M-26-A005', description: 'Civil engineering and construction contractor specialising in road rehabilitation and drainage.', full: 'Leone Builders is a civil engineering contractor working on road rehabilitation, drainage and small bridge projects, primarily under government and donor-funded programmes. The company holds a Class B contractor licence and operates its own plant.', employees: 210, founded: 2009 },
    { email: 'office@bosolar.sl', firstName: 'Yusuf', lastName: 'Mansaray', org: 'Bo Solar', tier: 'sme', sector: 'energy', region: 'Southern Province', size: 'SMALL', memberNo: 'FBF-M-26-A006', description: 'Solar home systems and mini-grid development for district towns across the Southern Province.', full: 'Bo Solar installs and maintains solar home systems on a pay-as-you-go basis and is developing two mini-grids serving district towns in the Southern Province. The company has connected more than 8,000 households since it was founded.', employees: 62, founded: 2017 },
    { email: 'trade@kenemacoffee.sl', firstName: 'Sia', lastName: 'Momoh', org: 'Kenema Coffee Union', tier: 'sme', sector: 'agriculture', region: 'Eastern Province', size: 'SMALL', memberNo: 'FBF-M-26-A007', description: 'Speciality coffee producer union working with 900 farming households in the Eastern Province.', full: 'Kenema Coffee Union aggregates, processes and markets speciality-grade robusta and liberica coffee from 900 farming households. The union operates a central washing station and has begun direct-trade relationships with roasters in Europe and North America.', employees: 30, founded: 2015 },
    { email: 'info@makenifoods.sl', firstName: 'Adama', lastName: 'Turay', org: 'Makeni Foods', tier: 'individual', sector: 'manufacturing', region: 'Northern Province', size: 'MICRO', memberNo: 'FBF-M-26-A008', description: 'Packaged snack foods made from locally grown groundnut, cassava and plantain.', full: 'Makeni Foods produces packaged snack foods from locally grown inputs, supplying supermarkets and informal retailers across the Northern Province and Freetown. The business is preparing to move from a rented unit into a purpose-built facility.', employees: 9, founded: 2021 },
  ]

  for (const m of memberData) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        passwordHash: devPassword,
        role: 'MEMBER',
        emailVerified: true,
        country: 'Sierra Leone',
      },
    })

    const member = await prisma.member.upsert({
      where: { userId: user.id },
      update: { status: 'ACTIVE' },
      create: {
        userId: user.id,
        memberNo: m.memberNo,
        tierId: tiers[m.tier],
        organisationName: m.org,
        status: 'ACTIVE',
        joinedAt: daysAgo(200),
        expiresAt: new Date(Date.now() + 165 * 86_400_000),
      },
    })

    const listing = {
      slug: m.org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      businessName: m.org,
      sectorId: sectors[m.sector],
      region: m.region,
      size: m.size,
      shortDescription: m.description,
      fullDescription: m.full,
      website: m.website ?? null,
      contactEmail: m.email,
      employees: m.employees,
      yearFounded: m.founded,
      isPublished: true,
      isFeatured: m.featured ?? false,
    }

    await prisma.directoryListing.upsert({
      where: { memberId: member.id },
      update: listing,
      create: { ...listing, memberId: member.id },
    })
  }
  console.log(`  ✓ ${memberData.length} members with directory listings`)

  // ── Deal Room opportunities ───────────────────────────────────────────────

  const opportunityData = [
    {
      slug: 'kambia-cashew-processing-expansion',
      title: 'Cashew processing capacity expansion, Kambia',
      memberEmail: 'mariama@saloneagro.sl',
      sector: 'agriculture',
      region: 'North West Province',
      stage: 'EXPANSION',
      min: usd(1_500_000),
      max: usd(3_000_000),
      summary:
        'Growth capital to triple processing capacity and add a certified organic line, backed by an existing 4,000-farmer outgrower network and signed European offtake.',
      description:
        'Salone Agro Processing is seeking growth capital to expand processing capacity at its Kambia facility from 3,000 to 9,000 tonnes annually, and to add a dedicated certified organic line.\n\nThe business currently processes and exports cashew and cocoa under organic and Fairtrade certification, working with an outgrower network of more than 4,000 smallholder farmers. Demand from existing European buyers exceeds current capacity, and the company is turning away orders. A signed letter of intent covers 60 per cent of the expanded output.\n\nThe constraint is seasonal working capital as much as plant: the crop is bought over a six-week window and sold over the following ten months.',
      useOfFunds:
        'Processing plant and installation (55%); dedicated organic line and certification (15%); seasonal working capital facility (25%); outgrower training and input supply (5%).',
    },
    {
      slug: 'freetown-cold-chain-facility',
      title: 'Cooperative cold chain facility, Freetown',
      memberEmail: 'info@freetownfisheries.sl',
      sector: 'fisheries',
      region: 'Western Area',
      stage: 'GROWTH',
      min: usd(800_000),
      max: usd(1_200_000),
      summary:
        'Sierra Leone’s first cooperative-owned cold storage and processing facility, serving a membership of more than 2,000 artisanal fishers.',
      description:
        'Freetown Fisheries Cooperative is raising capital to build a cold storage and primary processing facility at the main landing site, giving its 2,000 members the ability to hold catch rather than sell at whatever price is available on the day.\n\nThe cooperative already aggregates catch and supplies ice. The missing link is storage: without it, members are price-takers on the beach, and a substantial share of landed catch is lost to spoilage before it reaches a buyer.\n\nThe facility would also enable certified handling, opening export routes currently closed to the cooperative.',
      useOfFunds:
        'Cold storage construction and refrigeration plant (60%); primary processing equipment (20%); certification and food safety systems (10%); working capital (10%).',
    },
    {
      slug: 'southern-province-mini-grids',
      title: 'Two mini-grids serving district towns, Southern Province',
      memberEmail: 'office@bosolar.sl',
      sector: 'energy',
      region: 'Southern Province',
      stage: 'GROWTH',
      min: usd(2_000_000),
      max: usd(4_500_000),
      summary:
        'Development capital for two solar mini-grids with battery storage, serving approximately 6,000 connections across two district towns.',
      description:
        'Bo Solar is developing two solar mini-grids with battery storage to serve district towns currently without any grid connection, covering approximately 6,000 household and commercial connections.\n\nThe company has connected more than 8,000 households through pay-as-you-go solar home systems and has the field operation, collections infrastructure and maintenance capability already in place. Feasibility studies and demand surveys are complete for both sites.\n\nRegulatory approvals for mini-grid tariffs are in progress.',
      useOfFunds:
        'Generation and storage equipment (50%); distribution network construction (30%); metering and collections systems (10%); development and permitting costs (10%).',
    },
    {
      slug: 'merchant-payments-platform-scale-up',
      title: 'Merchant payments platform scale-up',
      memberEmail: 'hello@kroobay-tech.sl',
      sector: 'fintech',
      region: 'Western Area',
      stage: 'STARTUP',
      min: usd(500_000),
      max: usd(1_500_000),
      summary:
        'Series A to expand an offline-first merchant point-of-sale platform from 3,000 to 15,000 merchants and launch inventory-backed working capital.',
      description:
        'Kroo Bay Technologies is raising a Series A to scale its merchant point-of-sale and inventory platform from 3,000 to 15,000 active merchants, and to launch an inventory-backed working capital product built on the transaction data the platform already generates.\n\nThe software is designed offline-first — it works without a connection and reconciles when one is available, which is the difference between usable and unusable for most of the target market. It integrates with the major mobile money providers.\n\nUnit economics are positive on the core software product; the credit product is at pilot stage with 40 merchants.',
      useOfFunds:
        'Field sales and merchant onboarding (40%); engineering (25%); credit product capital and loss reserve (25%); regulatory and compliance (10%).',
    },
    {
      slug: 'peninsula-hotel-development',
      title: 'Mid-market hotel development, Freetown Peninsula',
      memberEmail: 'contact@peninsularesorts.sl',
      sector: 'tourism',
      region: 'Western Area',
      stage: 'EXPANSION',
      min: usd(3_000_000),
      max: usd(6_000_000),
      summary:
        'A 90-room mid-market property on a secured beachfront site, addressing the gap between budget guesthouses and the few high-end resorts.',
      description:
        'Peninsula Resorts is seeking development capital for a 90-room mid-market property on a secured beachfront site with title confirmed and outline planning permission granted.\n\nThe Freetown Peninsula has fewer than 3,000 classified rooms in total, and the gap in the market is squarely in the middle: business travellers, regional visitors and the diaspora consistently report that there is very little between a budget guesthouse and a high-end resort.\n\nThe operator has built and run three eco-lodges on the Peninsula and would manage the property under its existing brand and systems.',
      useOfFunds:
        'Construction (70%); fit-out and furnishing (18%); pre-opening and staff training (7%); working capital (5%).',
    },
  ]

  for (const opp of opportunityData) {
    const member = await prisma.member.findFirst({
      where: { user: { email: opp.memberEmail } },
    })

    const data = {
      title: opp.title,
      memberId: member?.id ?? null,
      sectorId: sectors[opp.sector],
      region: opp.region,
      stage: opp.stage,
      ticketSizeMinMinor: opp.min,
      ticketSizeMaxMinor: opp.max,
      currency: 'USD',
      summary: opp.summary,
      description: opp.description,
      useOfFunds: opp.useOfFunds,
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: daysAgo(20),
    }

    await prisma.opportunity.upsert({
      where: { slug: opp.slug },
      update: data,
      create: { ...data, slug: opp.slug },
    })
  }
  console.log(`  ✓ ${opportunityData.length} deal room opportunities`)

  // ── CMS pages ─────────────────────────────────────────────────────────────

  const pageData = [
    {
      slug: 'about',
      title: 'About the Freetown Business Forum',
      bodyJson: JSON.stringify({
        intro:
          'The Freetown Business Forum (FBF) is a non-profit organisation, founded on 12 December 2023, dedicated to empowering Sierra Leone’s business community.',
        vision:
          'A dynamic platform that strengthens the capacity of businesses through advocacy, knowledge-sharing, partnerships and resource mobilisation — fostering innovation, professionalism and sustainable development for the benefit of entrepreneurs and enterprises in Sierra Leone.',
        mandate:
          'The forum focuses on promoting small and medium enterprises, advancing trade and industries, supporting youth entrepreneurship, tourism and ecological protection, and strengthening human capital.\n\nFBF organises bi-annual events at which businesses that register have the opportunity to meet other business owners and business leaders in Sierra Leone and beyond. Membership is open to individuals and groups who own a business or an MSME.',
        governance:
          'The forum is led by its President, Dr. James Mohammed Mallah, and its Board Chairman, Hon. Patrick Michaelson Gibrilla. Day-to-day administration and programmes are run by the secretariat in Freetown under Sulaiman Keh Sesay, Director of Admin and Programs.',
      }),
    },
    {
      slug: 'membership',
      title: 'Membership',
      bodyJson: JSON.stringify({
        heroLead:
          'A directory listing that investors actually read, member rates on registration, a seat in the Deal Room, and a standing voice in the dialogue with government.',
        intro:
          'FBF membership is how a Sierra Leonean business stops waiting to be found. Members are listed in the national business directory, priced into the forum at the member rate, and admitted to the Deal Room where the secretariat matches propositions to capital.',
        // The three things membership opens, shown with a photograph each.
        // Three because that is the shape of the band; a fourth would wrap to
        // a second row and read as an afterthought.
        access: JSON.stringify([
          {
            title: 'The forum',
            body: 'Member rates on every registration, and three days in the room where government, capital and Sierra Leonean enterprise are all in the same place.',
            href: '/events',
            linkLabel: 'See the programme',
          },
          {
            title: 'The Deal Room',
            body: 'Propositions put in front of capital by the secretariat, with the introductions made in person at the forum rather than left to a search box.',
            href: '/deal-room',
            linkLabel: 'How the Deal Room works',
          },
          {
            title: 'The directory',
            body: 'A published listing in the national business directory, which is where investors and partners look first for a Sierra Leonean counterpart.',
            href: '/directory',
            linkLabel: 'Browse the directory',
          },
        ]),
        // Nested JSON inside the block, so the steps and questions stay
        // editable as CMS content without a table of their own.
        steps: JSON.stringify([
          {
            title: 'Apply',
            body: 'Tell us about your organisation and choose a tier. The form takes about ten minutes and can be saved and returned to.',
          },
          {
            title: 'Get approved',
            body: 'The secretariat checks your registration and confirms the tier that fits. Most applications are decided within five working days.',
          },
          {
            title: 'Benefit',
            body: 'Your directory listing goes live, member rates apply to every registration, and the Deal Room opens to you for the year.',
          },
        ]),
        faq: JSON.stringify([
          {
            q: 'Who can join FBF?',
            a: 'Any business registered in Sierra Leone, and any organisation trading with or investing in the country. Development partners and public bodies join under the Institutional tier.',
          },
          {
            q: 'How long does membership run?',
            a: 'Twelve months from the date your application is approved, not from the start of the calendar year. Renewal notices go out sixty days before expiry.',
          },
          {
            q: 'Can I change tier part-way through the year?',
            a: 'Yes. Moving up is charged pro rata for the months remaining. Moving down takes effect at renewal.',
          },
          {
            q: 'What does the directory listing include?',
            a: 'Your business name, sector, region, size, a description, logo, website and contact details. Members control what is published; some fields are visible only to other signed-in members.',
          },
          {
            q: 'Do I still pay to attend the forum?',
            a: 'Yes, but at the member rate, which is materially below the standard rate. Corporate and Patron tiers include complimentary registrations on top of that.',
          },
          {
            q: 'What is the Deal Room and does membership include it?',
            a: 'The Deal Room is the matched meeting programme that runs on the second day of the forum. Members can submit a proposition and request meetings; non-members cannot.',
          },
          {
            q: 'Can an individual join, or only an organisation?',
            a: 'Membership is held by an organisation. Named contacts within it can each be given portal access, so a colleague can book and manage registrations without sharing a login.',
          },
          {
            q: 'How do I pay?',
            a: 'By card, bank transfer or mobile money — Orange Money and Afrimoney are both accepted. Invoices can be issued for organisations that need one for internal approval.',
          },
          {
            q: 'Is membership refundable?',
            a: 'Subscriptions are non-refundable once approved, but they are transferable to a successor organisation in the case of a merger or rename. Write to the secretariat.',
          },
          {
            q: 'We are based outside Sierra Leone. Is that a problem?',
            a: 'No. A significant share of members are diaspora businesses and foreign investors. Everything except the directory region filter works identically from abroad.',
          },
        ]),
      }),
    },
    {
      slug: 'doing-business',
      title: 'Doing Business in Sierra Leone',
      bodyJson: JSON.stringify({
        intro:
          'A practical guide to registering, licensing, staffing and financing a business in Sierra Leone — written for investors arriving for the first time.',
        registration:
          'Companies are registered with the Corporate Affairs Commission. The process runs through the one-stop shop operated by the Sierra Leone Investment and Export Promotion Agency, which handles name reservation, incorporation, tax registration and the initial business licence in a single application.',
        tax:
          'Corporate income tax is charged at the standard rate, with reduced rates and holidays available for qualifying investments in agriculture, agro-processing, tourism and renewable energy. Goods and services tax applies above a registration threshold. Sierra Leone has a growing network of double taxation treaties.',
        incentives:
          'Sector-specific incentives include duty-free importation of capital equipment, corporate income tax holidays for qualifying investments, and negotiated fiscal stability under mining and infrastructure agreements. Incentives are administered through SLIEPA and must generally be applied for before the investment is made.',
        land:
          'Land tenure differs between the Western Area, where freehold title exists, and the provinces, where land is held under customary tenure and accessed through long leases negotiated with landowning families and chiefdom authorities. Investors are strongly advised to take local counsel before committing.',
        labour:
          'Work permits for non-nationals are issued by the Ministry of Labour. Employers are required to contribute to the National Social Security and Insurance Trust. The labour market is young, and technical and vocational skills are a common constraint — several sectors operate their own training partnerships.',
      }),
    },
    {
      slug: 'venue-travel',
      title: 'Venue & Travel',
      bodyJson: JSON.stringify({
        intro:
          'Everything you need to plan your trip to Freetown for the forum.',
        gettingHere:
          'Freetown is served by Lungi International Airport, with direct connections from Brussels, Paris, Istanbul, Casablanca, Accra, Lagos, Nairobi and Addis Ababa. The airport sits across the estuary from the city; transfer is by water taxi (approximately 30 minutes) or by road around the estuary (approximately three hours). The secretariat arranges a shared water taxi transfer for delegates who register their flight details in advance.',
        visas:
          'Most nationalities require a visa. Applications can be made online through the Sierra Leone e-visa portal or on arrival at Lungi for eligible passports. ECOWAS nationals do not require a visa. Delegates needing a supporting letter for a visa application can request one through the delegate portal once registration is confirmed. A yellow fever vaccination certificate is required for entry.',
        hotels:
          'A block of rooms has been held at hotels within fifteen minutes of the venue at negotiated forum rates. Booking details are sent with your registration confirmation. Delegates are advised to book early — the forum coincides with a busy period in Freetown.',
        practical:
          'The currency is the Leone (SLE). Mobile money — Orange Money and Afrimoney — is accepted almost everywhere and is the most practical way to pay for day-to-day expenses; card acceptance is limited outside hotels. English is the official language and is widely spoken, alongside Krio. Freetown traffic is heavy: allow substantially more time than the distance suggests.',
      }),
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      bodyJson: JSON.stringify({
        intro:
          'This policy explains what personal data the Freetown Business Forum collects, why, and what rights you have over it.',
        collection:
          'We collect the information you give us when you register for the forum, apply for membership, submit a proposition to the Deal Room, subscribe to the newsletter or contact us. This includes your name, contact details, organisation and any information you choose to include in a submission.',
        payments:
          'We do not store card details. Card payments are handled entirely on our payment provider’s hosted page; we receive only a transaction reference. Mobile money payments are processed by the wallet provider, and we record the transaction reference and the phone number you supply.',
        use:
          'We use your data to process your registration or membership, issue your ticket and receipt, respond to your enquiry, and — where you have opted in — send you the newsletter. We do not sell personal data. Directory listings are published only where a member has chosen to publish them.',
        rights:
          'You can ask us for a copy of the data we hold about you, ask us to correct it, or ask us to delete it, by writing to the secretariat. You can unsubscribe from the newsletter using the link in any issue.',
      }),
    },
    {
      slug: 'terms',
      title: 'Terms & Conditions',
      bodyJson: JSON.stringify({
        intro:
          'These terms govern your use of the FBF website, forum registration and membership.',
        registration:
          'A registration is confirmed only when payment has been received in full, or, in the case of an invoice, when the secretariat has confirmed the payment. Delegate passes are personal and may be transferred to a colleague with written notice to the secretariat before the forum opens.',
        cancellation:
          'Cancellations received more than eight weeks before the forum are refunded in full less an administration fee. Cancellations received between four and eight weeks before are refunded at 50 per cent. No refund is available within four weeks of the forum, though a substitute delegate may be nominated at any time.',
        conduct:
          'Delegates are expected to conduct themselves professionally. The secretariat reserves the right to withdraw a pass without refund in cases of harassment or misconduct.',
        liability:
          'FBF is not liable for travel or accommodation costs in the event that the forum is postponed or cancelled. Delegates are strongly advised to hold appropriate travel insurance.',
      }),
    },
  ]

  for (const page of pageData) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: { title: page.title },
      // bodyJson is not overwritten on update — CMS edits must survive re-seeding.
      create: { ...page, status: 'PUBLISHED', updatedById: users['editor@fbf.sl'] },
    })
  }
  console.log(`  ✓ ${pageData.length} CMS pages`)

  // ── Media ─────────────────────────────────────────────────────────────────

  const collectionData = [
    { slug: 'forum-gallery', name: 'Forum photo gallery', kind: 'GALLERY', description: 'Photographs from previous editions of the forum.', sortOrder: 1 },
    { slug: 'forum-videos', name: 'Video highlights', kind: 'VIDEO', description: 'Session recordings and highlight reels.', sortOrder: 2 },
    { slug: 'downloads', name: 'Downloads & reports', kind: 'DOWNLOAD', description: 'Brochures, prospectuses and published research.', sortOrder: 3 },
  ]

  const collections: Record<string, string> = {}
  for (const collection of collectionData) {
    const row = await prisma.mediaCollection.upsert({
      where: { slug: collection.slug },
      update: collection,
      create: { ...collection, isPublished: true },
    })
    collections[collection.slug] = row.id
  }

  /**
   * The forum's own photographs.
   *
   * These are rows rather than a constant inside the hero component because
   * the homepage mosaic reads its tiles from this collection (FR-01) — which
   * photographs appear, and in what order, is a `sortOrder` edit rather than a
   * deploy. §3.4 asks for authentic Sierra Leonean photography and these are
   * exactly that: the secretariat's own record of its engagements.
   *
   * `url` points at files squared to 640px in `public/brand/hero/`, derived
   * from the originals in `public/`. The originals stay where they are — two
   * of them are over 10MB, which is not something to put in a hero on a 3G
   * handset (NFR-01).
   *
   * Captions on the four engagement photographs come from the filenames the
   * secretariat supplied. The rest describe only what is visible in the frame;
   * naming the people or the occasion is for the secretariat to do.
   */
  const galleryAssetData = [
    {
      id: 'gallery-delegation',
      filename: 'delegation.jpg',
      title: 'Visiting delegation',
      altText: 'Forum representatives with a visiting international delegation',
      sizeBytes: 73316,
      sortOrder: 1,
    },
    {
      id: 'gallery-saudi-embassy',
      filename: 'saudi-embassy.jpg',
      title: 'Embassy of the Kingdom of Saudi Arabia',
      altText:
        'Part of the executive with the Ambassador and senior staff of the Embassy of the Kingdom of Saudi Arabia in Sierra Leone',
      sizeBytes: 74048,
      sortOrder: 2,
    },
    {
      id: 'gallery-boardroom',
      filename: 'boardroom.jpg',
      title: 'In the boardroom',
      altText: 'Secretariat colleagues at work around the boardroom table',
      sizeBytes: 85228,
      sortOrder: 3,
    },
    {
      id: 'gallery-ghana-commission',
      filename: 'ghana-commission.jpg',
      title: 'Ghana High Commission',
      altText: 'The executive at the Ghana High Commission in Sierra Leone',
      sizeBytes: 71045,
      sortOrder: 4,
    },
    {
      id: 'gallery-egypt-ambassador',
      filename: 'egypt-ambassador.jpg',
      title: 'Egyptian Ambassador to Sierra Leone',
      altText:
        'With the Egyptian Ambassador to Sierra Leone following an engagement',
      sizeBytes: 78046,
      sortOrder: 5,
    },
    {
      id: 'gallery-handshake',
      filename: 'handshake.jpg',
      title: 'Agreement reached',
      altText: 'A meeting closing with a handshake',
      sizeBytes: 82340,
      sortOrder: 6,
    },
    {
      id: 'gallery-office-meeting',
      filename: 'office-meeting.jpg',
      title: 'A working meeting',
      altText: 'A working meeting in the forum office',
      sizeBytes: 78381,
      sortOrder: 7,
    },
    {
      id: 'gallery-working-session',
      filename: 'working-session.jpg',
      title: 'Preparing a session',
      altText: 'Two colleagues working through papers at a session',
      sizeBytes: 70676,
      sortOrder: 8,
    },
  ]

  // Anything not on the list above goes, so a database seeded with an earlier
  // selection does not keep photographs the secretariat has since dropped.
  await prisma.mediaAsset.deleteMany({
    where: {
      collectionId: collections['forum-gallery'],
      id: { notIn: galleryAssetData.map((asset) => asset.id) },
    },
  })

  for (const asset of galleryAssetData) {
    const row = {
      ...asset,
      url: `/brand/hero/${asset.filename}`,
      mimeType: 'image/jpeg',
      kind: 'GALLERY',
      collectionId: collections['forum-gallery'],
      isPublic: true,
    }
    await prisma.mediaAsset.upsert({
      where: { id: asset.id },
      update: row,
      create: row,
    })
  }
  console.log(`  ✓ ${galleryAssetData.length} gallery photographs`)

  /**
   * The forum's own video.
   *
   * Self-hosted under `public/brand/video/`, unlike the rest of the video
   * collection, which is expected to be recordings held on a platform that
   * already has the captions and the bandwidth. A local URL is how the
   * recordings page and the homepage tell the two apart: a `/`-relative one is
   * played in place, anything else is linked out to its host.
   *
   * The clip is portrait because it was filmed on a phone, and it is shown
   * that way rather than cropped — see `site/video-feature`. `thumbnailUrl` is
   * deliberately null: there is no poster frame to hand, and the player shows
   * the first frame once it has the metadata, which is the same picture.
   */
  const videoAssetData = [
    {
      id: 'video-inside-the-forum',
      filename: 'inside-the-forum.mp4',
      url: '/brand/video/inside-the-forum.mp4',
      title: 'Inside the Freetown Business Forum',
      altText:
        'Footage from a Freetown Business Forum engagement, filmed by the secretariat',
      caption:
        'Forty seconds inside the forum — the meetings, the delegations and the people who make them happen.',
      mimeType: 'video/mp4',
      sizeBytes: 4873712,
      sortOrder: 1,
    },
  ]

  await prisma.mediaAsset.deleteMany({
    where: {
      collectionId: collections['forum-videos'],
      id: { notIn: videoAssetData.map((asset) => asset.id) },
    },
  })

  for (const asset of videoAssetData) {
    const row = {
      ...asset,
      kind: 'VIDEO',
      collectionId: collections['forum-videos'],
      isPublic: true,
    }
    await prisma.mediaAsset.upsert({
      where: { id: asset.id },
      update: row,
      create: row,
    })
  }
  console.log(`  ✓ ${videoAssetData.length} video`)

  // ── Testimonials ──────────────────────────────────────────────────────────

  const testimonialData = [
    {
      slug: 'ecobank-sl',
      quote:
        'We came to the forum with a shortlist and left with signed term sheets. Nowhere else in the region puts the regulator, the ministry and the promoter around one table on the same morning.',
      authorName: 'Aminata Sesay',
      authorRole: 'Head of Corporate Banking',
      organisation: 'Ecobank Sierra Leone',
      sortOrder: 1,
    },
    {
      slug: 'afdb',
      quote:
        'The Deal Room is the most disciplined matchmaking we have seen on the continent. Propositions arrive screened, and the meetings are scheduled before you land.',
      authorName: 'Kwame Boateng',
      authorRole: 'Principal Investment Officer',
      organisation: 'African Development Bank',
      sortOrder: 2,
    },
    {
      slug: 'salone-agro',
      quote:
        'Three days of the forum did more for our funding pipeline than a year of cold introductions. We closed our Series A with an investor we met in a sector roundtable.',
      authorName: 'Fatmata Kargbo',
      authorRole: 'Founder & Chief Executive',
      organisation: 'Salone Agro Processing',
      sortOrder: 3,
    },
    {
      slug: 'ministry-trade',
      quote:
        'A standing dialogue rather than an annual photo call. The private sector brings us evidence, and policy moves because of it.',
      authorName: 'Hon. Ibrahim Turay',
      authorRole: 'Permanent Secretary',
      organisation: 'Ministry of Trade & Industry',
      sortOrder: 4,
    },
  ]

  for (const testimonial of testimonialData) {
    await prisma.testimonial.upsert({
      where: { slug: testimonial.slug },
      update: testimonial,
      create: { ...testimonial, isPublished: true },
    })
  }
  console.log(`  ✓ ${testimonialData.length} testimonials`)

  console.log('\nSeed complete.')
  console.log(`  Sign in at /portal/login with admin@fbf.sl / FBFdev2026!`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
