'use client'

import { RevealItem, RevealStagger } from './components/ui/motion-ui'
import { motion } from 'framer-motion'

/** Day-of schedule — compact tables for participants. */
const DAY_SCHEDULES = [
  {
    day: 'DAY 1',
    date: 'Fri 24 Jul',
    rows: [
      { time: '09:30 – 10:30', activity: 'Registration @ A.1.20 + merch' },
      { time: '10:30 – 11:30', activity: 'Opening ceremony @ A.1.20' },
      { time: '11:30 – 12:00', activity: 'Grab your lunch → move to hacking rooms' },
      { time: '12:00 – 22:00', activity: 'Hacking @ B.5.12/13 & B.2.07/08', highlight: true },
      { time: '13:00 – 15:00', activity: 'Group mentoring @ SR B.4.08 & SR B.4.07' },
      { time: '18:00', activity: 'Dinner' },
      { time: '18:00 – 22:00', activity: 'Fringe game – Prompt Relay @ SR B.4.07' },
      { time: '22:00', activity: 'End of Day 1' },
    ],
  },
  {
    day: 'DAY 2',
    date: 'Sat 25 Jul',
    rows: [
      { time: '09:00 – 10:00', activity: 'Check-in' },
      { time: '10:00 – 12:00', activity: 'Hacking continues' },
      { time: '12:00', activity: 'Submission deadline — strict', highlight: true },
      { time: '12:00 – 13:00', activity: 'Lunch (buffet)' },
      { time: '13:00 – 15:30', activity: 'Pitching to Judges' },
      { time: '15:30 – 16:30', activity: 'Project Showcase + Voting' },
      { time: '16:30 – 17:30', activity: 'Entrepreneurship workshop @ A.1.20' },
      { time: '17:30 – 18:00', activity: 'Closing + winner announcement + group photo' },
    ],
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

function DaySchedule({ day, date, rows }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-2 pb-2 border-b border-white">
        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-red-600 leading-none">
          {day}
        </h3>
        <span className="text-xs sm:text-sm text-gray-300 tracking-wide whitespace-nowrap">
          {date}
        </span>
      </div>

      <div>
        {rows.map((row, i) => {
          const highlight = Boolean(row.highlight)
          return (
            <div
              key={`${row.time}-${i}`}
              className="grid grid-cols-[7.25rem_1fr] sm:grid-cols-[8.5rem_1fr] gap-x-3 sm:gap-x-4 items-start py-2 border-b border-gray-800 last:border-b-0"
              style={
                highlight
                  ? { backgroundColor: 'rgba(192, 0, 0, 0.14)' }
                  : undefined
              }
            >
              <div
                className={`text-[11px] sm:text-xs font-bold tracking-wide leading-snug pl-2 sm:pl-2.5 ${
                  highlight ? 'text-red-500' : 'text-white'
                }`}
              >
                {row.time}
              </div>
              <div
                className={`text-[11px] sm:text-xs leading-snug pr-2 sm:pr-2.5 ${
                  highlight ? 'text-white font-semibold' : 'text-gray-300'
                }`}
              >
                {row.activity}
              </div>
            </div>
          )
        })}
      </div>
    </div>
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
  const gold   = SPONSORS.filter(s => s.tier === 'gold')
  const silver = SPONSORS.filter(s => s.tier === 'silver')
  const bronze = SPONSORS.filter(s => s.tier === 'bronze')

  return (
    <section id="timeline" className="bg-[#1a1a1a] px-6 md:px-12 pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-12 font-mono scroll-mt-11">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="HACKATHON_TIMELINE"
          subtitle="// 24–25 JULY 2026 · SIM CAMPUS · FULL DAY-OF SCHEDULE"
        />

        <RevealStagger
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-14 sm:mb-16"
          stagger={0.08}
        >
          {DAY_SCHEDULES.map((schedule) => (
            <RevealItem key={schedule.day}>
              <DaySchedule {...schedule} />
            </RevealItem>
          ))}
        </RevealStagger>

        {REVEAL_TRACKS_AND_JUDGES && (
          <div id="judges">
            <SectionHeader title="JUDGES_AND_MENTORS" subtitle="// INDUSTRY EXPERTS EVALUATING AND GUIDING YOUR WORK" />
            <RevealStagger className="flex flex-col" stagger={0.1}>
              {JUDGES.map((judge) => (
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