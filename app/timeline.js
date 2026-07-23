'use client'

import { useEffect, useState } from 'react'
import { RevealItem, RevealStagger } from './components/ui/motion-ui'
import { motion } from 'framer-motion'

const EVENTS = [
  {
    date: '16 JUL 2026',
    title: 'REGISTRATION DEADLINE',
    time: '11:59 PM',
    meta: 'SGT · TEAM REGISTRATION FORM',
    endsAt: '2026-07-16T23:59:59+08:00',
  },
  {
    date: '24 JUL 2026',
    title: 'OPENING CEREMONY',
    time: '10:30 AM - 11:30 AM',
    meta: 'SIM CAMPUS · A.1.20',
    endsAt: '2026-07-24T11:30:00+08:00',
  },
  {
    date: '24–25 JUL 2026',
    title: 'HACKING PERIOD',
    time: '12:00 PM (24 JUL) - 12:00 PM (25 JUL)',
    meta: 'SIM CAMPUS · B.5.12/13 & B.2.07/08',
    endsAt: '2026-07-25T12:00:00+08:00',
  },
  {
    date: '25 JUL 2026',
    title: 'SUBMISSION DEADLINE',
    time: '12:00 PM',
    meta: 'SGT · PROJECT PORTAL',
    endsAt: '2026-07-25T12:00:00+08:00',
  },
  {
    date: '25 JUL 2026',
    title: 'JUDGING + WINNERS',
    time: '1:00 PM - 6:00 PM',
    meta: 'SIM CAMPUS',
    endsAt: '2026-07-25T18:00:00+08:00',
  },
]

const REVEAL_TRACKS_AND_JUDGES = process.env.NEXT_PUBLIC_REVEAL_TRACKS_AND_JUDGES === 'true'

const JUDGES = [
  {
    name: 'CHER LIM',
    role: 'AI EDUCATOR',
    company: 'SIM GLOBAL EDUCATION · WINE TREASURES',
    bio: 'Educator at SIM Global Education teaching AI and machine learning across partner-university programs: deep learning, ML algorithm development, data visualization, and AI project modules. Teaching Excellence Award 2025 and 15-Year Lecturer Service Award recipient at SIM.',
    linkedin: 'https://www.linkedin.com/in/cher-l-812959/',
    img: '/judges/cher-lim.png',
  },
  {
    name: 'RICHARD LEE',
    role: 'CHIEF ARCHITECT',
    company: 'INTELWAVE AI',
    bio: 'Leads a team architecting and scaling agentic systems at IntelWave AI. AWS AI Engineering Community Builder and Y Combinator hackathon alum. Speaker at Amazon, Tencent, Stripe, SMU, and ClawCon; contributor to CNBC and The Business Times. Has judged Agora, Hack&Roll, and TinyFish.',
    linkedin: 'https://www.linkedin.com/in/yaksheng/',
    img: '/judges/richard-lee.png',
  },
  {
    name: 'DILEEPA RAJAPAKSA',
    role: 'CLOUD, CHANNEL SPECIALIST',
    company: 'PAX8 · MICROSOFT MVP',
    bio: 'Microsoft MVP and MCT in AI, cloud technologies, and the Microsoft ecosystem. Over 15 years in solution architecture, Azure, and partner enablement. Passionate about empowering the technical community through mentoring, public speaking, and real-world innovation.',
    linkedin: 'https://www.linkedin.com/in/rajapaksa/',
    img: '/judges/dileepa-rajapaksa.png',
  },
  {
    name: 'VINCENT CHOY',
    role: 'SENIOR CLOUD CONSULTANT',
    company: 'FEDELELIS · MICROSOFT MVP',
    bio: 'Microsoft MVP for Microsoft 365 and Copilot, honored every year since 2014. Global judge and mentor for the Microsoft Imagine Cup. Frequent international speaker on security and digital transformation, passionate about guiding students to turn bold ideas into lasting impact.',
    linkedin: 'https://www.linkedin.com/in/office365mvp/',
    img: '/judges/vincent-choy.png',
  },
]

const MENTORS = [
  {
    name: 'ROGER YEO',
    role: 'MENTOR',
    company: 'NAVTECH · GEEKSHACKING',
    bio: 'Ministry Director at The Navigators and Co-Founder of GeeksHacking. Software developer with a strong background in leadership, collaboration, and technical problem-solving. Youth mentor with NavTeens for over 15 years, bringing a practical, real-world lens to building technology that serves people.',
    linkedin: 'https://www.linkedin.com/in/rogeryeosm/',
    img: '/judges/roger-yeo.png',
  },
  {
    name: 'SENTHAMIL',
    role: 'MENTOR',
    company: 'ACUMANT · MICROSOFT MVP',
    bio: 'AI solutions architect specializing in Azure AI Foundry, MCP-based extensibility, and agentic frameworks for enterprise automation. Designs modern AI systems with autonomous agents, secure API orchestration, and deep Microsoft ecosystem integration — including Copilot Studio, Power Platform, and GitHub Copilot.',
    linkedin: 'https://www.linkedin.com/in/altfo/',
    img: '/judges/senthamil.png',
  },
]

const SPONSORS = [
  {
    name: 'DynamicWeb',
    tier: 'gold',
    img: '/sponsors/dynamicweb.png',
    url: 'https://dynamicweb.com/',
    logoClass:
      'w-full max-w-[min(100%,26rem)] h-auto max-h-28 sm:max-h-36 md:max-h-40 object-contain transition-transform duration-200 group-hover:scale-[1.03]',
  },
  { name: 'IAMCP', tier: 'gold', img: '/sponsors/iamcp.png', url: 'https://www.iamcp.org/' },
]

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-10 sm:mb-12">
      <div className="flex items-center gap-3 sm:gap-5 mb-3">
        <div className="flex-1 h-px bg-red-700" />
        <span className="text-xs sm:text-base md:text-xl font-bold tracking-widest text-white whitespace-nowrap font-mono">
          {title}
        </span>
        <div className="flex-1 h-px bg-red-700" />
      </div>
      {subtitle && (
        <p className="text-center text-xs tracking-widest text-gray-400 font-mono mt-2">
          {subtitle}
        </p>
      )}
    </div>
  )
}

function Label({ children }) {
  return (
    <div className="text-red-500 text-xs tracking-widest font-mono mb-1.5">
      {children}
    </div>
  )
}

function Meta({ children }) {
  return (
    <div className="text-gray-400 text-xs tracking-widest font-mono">
      {children}
    </div>
  )
}

function ActionButton({ href, children }) {
  const cls =
    "cursor-pointer border border-gray-500 text-gray-300 text-xs tracking-widest font-mono px-4 sm:px-5 py-2 hover:border-white hover:text-white transition-all duration-200 inline-flex items-center gap-2"

  if (!href || href === '#') return null

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  )
}

function parseDateTime(dateStr, timeStr) {
  const monthMap = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  }

  const [day, mon, year] = dateStr.split(' ')
  const [startTime, rawEnd] = timeStr.split(' - ')
  const endTime = rawEnd || startTime

  function convert(t) {
    let [time, modifier] = t.split(' ')
    let [hours, minutes] = time.split(':')

    if (modifier === 'PM' && hours !== '12') hours = String(+hours + 12)
    if (modifier === 'AM' && hours === '12') hours = '00'

    return `${year}${monthMap[mon]}${day.padStart(2, '0')}T${hours.padStart(
      2,
      '0'
    )}${minutes}00`
  }

  return {
    start: convert(startTime),
    end: convert(endTime),
  }
}

function buildGoogleCalendarLink({ title, date, time, meta }) {
  if (!time || !date || date === 'DATES_PENDING' || date.includes('–')) return '#'

  const { start, end } = parseDateTime(date, time)

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${start}/${end}&location=${encodeURIComponent(meta)}`
}

function useNow() {
  const [now, setNow] = useState(null)
  useEffect(() => {
    setNow(Date.now())
  }, [])
  return now
}

function isEnded(endsAt, now) {
  if (!endsAt || now == null) return false
  return now >= new Date(endsAt).getTime()
}

function TimelineItem({ date, title, time, meta, isLast, isPassed, isNext }) {
  const isPending = date === 'DATES_PENDING' || date.includes('–')

  const calendarLink = !isPending && !isPassed
    ? buildGoogleCalendarLink({ title, date, time, meta })
    : null

  const markerClass = isPassed ? 'bg-gray-600' : isNext ? 'bg-red-600' : 'bg-red-700'
  const lineClass = isPassed ? 'bg-gray-700' : 'bg-red-700'

  return (
    <RevealItem>
    <motion.div
      className={`flex gap-4 sm:gap-8 ${isPassed ? 'opacity-45' : ''}`}
      whileHover={isPassed ? undefined : { x: 4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <div className="flex flex-col items-center w-4 flex-shrink-0">
        <div
          className={`w-3.5 ${markerClass}`}
          style={{
            height: 18,
            clipPath: 'polygon(50% 0%, 100% 35%, 100% 100%, 0% 100%, 0% 35%)',
          }}
        />
        {!isLast && <div className={`w-0.5 ${lineClass} flex-1 min-h-12`} />}
      </div>

      <div className="flex-1 pb-8 sm:pb-10 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <div className="text-red-500 text-xs tracking-widest font-mono mb-1.5">{date}</div>
          {isPassed && (
            <span className="text-[10px] sm:text-xs tracking-widest font-mono text-gray-500 mb-1.5">
              // CLOSED
            </span>
          )}
          {!isPassed && isNext && (
            <span className="text-[10px] sm:text-xs tracking-widest font-mono text-red-500 mb-1.5">
              // UP NEXT
            </span>
          )}
        </div>

        <div className={`text-base sm:text-xl font-bold tracking-wider font-mono mb-1.5 ${isPassed ? 'text-gray-500' : 'text-white'}`}>
          {title}
        </div>

        {time && <Meta>{time} // {meta}</Meta>}
        {!time && meta && <Meta>{meta}</Meta>}

        {!isPending && !isPassed && calendarLink && calendarLink !== '#' && (
          <div className="mt-4">
            <ActionButton href={calendarLink}>
              <span className="flex items-center gap-2">
                <img src="/google_calendar.svg" className="w-4 h-4" alt="" />
                SET_REMINDER
              </span>
            </ActionButton>
          </div>
        )}
      </div>
    </motion.div>
    </RevealItem>
  )
}

function JudgeRow({ name, role, company, bio, linkedin, img, isLast }) {
  return (
    <RevealItem>
    <motion.div
      className="flex gap-4 sm:gap-8"
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <div className="flex flex-col items-center w-4 flex-shrink-0">
        <div className="w-3.5 flex-shrink-0 bg-gray-600" style={{ height: 18, clipPath: 'polygon(50% 0%, 100% 35%, 100% 100%, 0% 100%, 0% 35%)' }} />
        {!isLast && <div className="w-0.5 bg-gray-700 flex-1 min-h-20" />}
      </div>
      <div className="flex-1 pb-12 sm:pb-16 pt-1">
        <div className="flex gap-4 sm:gap-8 md:gap-10 items-start">
          <motion.div
            className="flex-shrink-0 overflow-hidden bg-gray-800 border border-gray-700 rounded-xl w-16 h-16 sm:w-28 sm:h-28 md:w-36 md:h-36 flex items-center justify-center"
            whileHover={{ scale: 1.04, borderColor: '#c00000' }}
          >
            {img ? (
              <img src={img} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-gray-500 text-xs font-mono">IMG</div>
            )}
          </motion.div>
          <div className="flex-1 min-w-0">
            <Label>{role}</Label>
            <div className="text-white text-lg sm:text-2xl md:text-3xl font-bold tracking-wider font-mono mb-1 leading-tight">{name}</div>
            <Meta>{company}</Meta>
            <div className="border-t border-gray-700 my-4 sm:my-5" />
            <p className="text-gray-400 text-xs sm:text-sm tracking-wide leading-relaxed font-mono mb-5">{bio}</p>
            {linkedin && <ActionButton href={linkedin}>LINKEDIN ↗</ActionButton>}
          </div>
        </div>
      </div>
    </motion.div>
    </RevealItem>
  )
}

function SponsorRow({ tier, sponsors }) {
  const tierMeta = {
    gold:   { label: 'TITLE SPONSOR'},
    silver: { label: 'SILVER TIER', sub: '// SUPPORTING SPONSORS' },
    bronze: { label: 'BRONZE TIER', sub: '// COMMUNITY PARTNERS' },
  }
  const { label, sub } = tierMeta[tier]
  const logoClass =
    tier === 'gold'
      ? 'w-full max-w-[min(100%,22rem)] h-auto max-h-20 sm:max-h-28 md:max-h-32 object-contain transition-transform duration-200 group-hover:scale-[1.03]'
      : 'w-full max-w-40 sm:max-w-48 max-h-14 sm:max-h-16 object-contain grayscale brightness-75 group-hover:brightness-100 transition-all duration-200'

  return (
    <div className="mb-12 sm:mb-16 last:mb-0">
      <div className="mb-6 sm:mb-8">
        <Label>{label}</Label>
        <Meta>{sub}</Meta>
      </div>
      <div
        className={`grid gap-5 md:gap-8 items-stretch ${
          sponsors.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {sponsors.map((s, i) => {
          const goldCardSize =
            'h-[148px] sm:h-[188px] md:h-[220px] w-full p-8 sm:p-10 md:p-12'
          const card = (
            <div
              className={`group relative flex h-full w-full items-center justify-center border-2 border-[#d5d0c8] bg-[#f2ede5] transition-all duration-200 hover:border-red-600 hover:shadow-[8px_8px_0_0_#c00000] hover:-translate-y-1 ${
                tier === 'gold'
                  ? goldCardSize
                  : 'h-[100px] sm:h-[120px] w-full p-6 sm:p-8'
              }`}
            >
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-red-600 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-red-600 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
              {s.img ? (
                <img src={s.img} alt={s.name} className={s.logoClass ?? logoClass} />
              ) : (
                <div className="text-[#1d1c17] text-sm sm:text-base font-bold tracking-wider font-mono text-center px-4">
                  {s.name}
                </div>
              )}
            </div>
          )

          return s.url ? (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              {card}
            </a>
          ) : (
            <div key={i} className="h-full w-full">{card}</div>
          )
        })}
      </div>
    </div>
  )
}

function SupportedByRow() {
  return (
    <div className="mb-12 sm:mb-16 last:mb-0 mt-12 sm:mt-16">
      <div className="mb-6 sm:mb-8">
        <Label>SUPPORTED BY</Label>
      </div>
      <div className="max-w-md">
        <div className="group relative flex h-[100px] sm:h-[120px] w-full items-center justify-center border-2 border-[#d5d0c8] bg-[#f2ede5] p-6 sm:p-8 transition-all duration-200 hover:border-red-600 hover:shadow-[8px_8px_0_0_#c00000] hover:-translate-y-1">
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-red-600 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-red-600 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <img
            src="/sponsors/sim-student-life.png"
            alt="SIM Student Life"
            className="w-full max-w-48 sm:max-w-56 max-h-14 sm:max-h-16 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
      </div>
    </div>
  )
}

export default function TimeLine() {
  const now = useNow()
  const gold   = SPONSORS.filter(s => s.tier === 'gold')
  const silver = SPONSORS.filter(s => s.tier === 'silver')
  const bronze = SPONSORS.filter(s => s.tier === 'bronze')
  const nextIndex = now == null ? -1 : EVENTS.findIndex((event) => !isEnded(event.endsAt, now))

  return (
    <section id="timeline" className="bg-[#1a1a1a] px-6 md:px-12 pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-12 font-mono scroll-mt-11">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="HACKATHON_TIMELINE"
          subtitle="// 24–25 JULY 2026 · SIM CAMPUS · FULL SCHEDULE DROPS ONCE LOCKED IN."
        />

        <RevealStagger className="flex flex-col" stagger={0.07}>
          {EVENTS.map((event, i) => (
            <TimelineItem
              key={i}
              {...event}
              isLast={i === EVENTS.length - 1}
              isPassed={isEnded(event.endsAt, now)}
              isNext={nextIndex >= 0 && i === nextIndex}
            />
          ))}
        </RevealStagger>

        {REVEAL_TRACKS_AND_JUDGES && (
          <div id="judges">
            <SectionHeader title="JUDGES_AND_MENTORS" subtitle="// INDUSTRY EXPERTS EVALUATING AND GUIDING YOUR WORK" />
            <RevealStagger className="flex flex-col" stagger={0.1}>
              {JUDGES.map((judge, i) => (
                <JudgeRow key={judge.name} {...judge} isLast={false} />
              ))}
              {MENTORS.map((mentor, i) => (
                <JudgeRow key={mentor.name} {...mentor} isLast={i === MENTORS.length - 1} />
              ))}
            </RevealStagger>
          </div>
        )}

        <SectionHeader title="SPONSORS_AND_PARTNERS" subtitle="// ORGANISATIONS MAKING THIS POSSIBLE" />
        {gold.length   > 0 && <SponsorRow tier="gold"   sponsors={gold}   />}
        {silver.length > 0 && <SponsorRow tier="silver" sponsors={silver} />}
        {bronze.length > 0 && <SponsorRow tier="bronze" sponsors={bronze} />}

        <SupportedByRow />

        <div className="w-full h-px bg-red-700 mt-12 sm:mt-20 mb-8 sm:mb-16" />

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-10 py-6 sm:py-8">
          <div className="flex-shrink-0 sm:w-36">
            <Label>ENQUIRIES</Label>
            <Meta>// SPONSORSHIP</Meta>
          </div>
          <div className="flex-1">
            <div className="text-white text-lg sm:text-2xl font-bold tracking-wider font-mono mb-2 sm:mb-3">
              BECOME A SPONSOR
            </div>

            <Meta>
              INTERESTED IN SUPPORTING THE NEXT GENERATION OF BUILDERS?
              <br />
              Get in touch at{' '}
              <a
                href="mailto:it@mymail.sim.edu.sg"
                className="underline text-white"
              >
                it@mymail.sim.edu.sg
              </a>
            </Meta>
          </div>
        </div>
      </div>
    </section>
  )
}