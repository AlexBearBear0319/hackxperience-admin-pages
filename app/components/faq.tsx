"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IBM_Plex_Mono, Montserrat } from "next/font/google";
import { HoverLift, RevealItem, RevealStagger } from "./ui/motion-ui";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["800", "900"],
});

import { TEAM_REGISTRATION_URL, LOOKING_FOR_TEAM_URL, REGISTRATION_OPEN } from "@/lib/site-links";
import { MICROSOFT_FOUNDRY_WORKSHOP } from "@/lib/hackathon-pre-events";
import { PRIZE_POOL_WORTH } from "@/lib/hackathon-prizes";
import { REVEAL_TRACKS_AND_JUDGES } from "@/lib/event-reveal";

const FormLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">
    {children}
  </a>
);

const TeamRegistrationLink = () =>
  TEAM_REGISTRATION_URL ? (
    <FormLink href={TEAM_REGISTRATION_URL}>Team Registration Form</FormLink>
  ) : (
    <>Team Registration Form</>
  );

const LookingForTeamLink = () =>
  LOOKING_FOR_TEAM_URL ? (
    <FormLink href={LOOKING_FOR_TEAM_URL}>Looking for a Team form</FormLink>
  ) : (
    <>Looking for a Team form</>
  );

interface FaqItem {
  question: string;
  answer: ReactNode;
}

interface FaqCategory {
  label: string;
  items: FaqItem[];
}

function buildFaqData(): FaqCategory[] {
  return [
  {
    label: "REGISTRATION",
    items: [
      {
        question: "HOW DO I REGISTER FOR HACKXPERIENCE 2026?",
        answer: REGISTRATION_OPEN ? (
          <>
            Your team&apos;s <strong>Team Leader</strong> completes the <TeamRegistrationLink /> on behalf of the team. Registration closes on <strong>16 July 2026, 23:59 SGT</strong>.
          </>
        ) : (
          <>
            Registration closed on <strong>16 July 2026, 23:59 SGT</strong>. New team sign-ups are no longer accepted. Join the Telegram group for event updates if you&apos;re already registered.
          </>
        ),
      },
      {
        question: "WHAT IS THE TEAM SIZE?",
        answer: "All teams must have 3 to 4 members. Choose one Team Leader as the primary point of contact with the organisers. They will submit the registration form for the whole team.",
      },
      {
        question: "I'M SOLO OR DON'T HAVE A FULL TEAM YET",
        answer: REGISTRATION_OPEN ? (
          <>
            If you&apos;re registering solo or with fewer than 3 members, please fill out the <LookingForTeamLink /> and our crew will facilitate the group formation.
          </>
        ) : (
          <>
            Registration is closed, so new solo / incomplete-team sign-ups are no longer accepted. If you already registered, check Telegram for team-formation updates from the organisers.
          </>
        ),
      },
      {
        question: "CAN I TEAM UP WITH STUDENTS FROM OTHER UNIVERSITIES?",
        answer: "Yes. Active SIM students (foundations, diploma, undergraduate, and masters programmes) may invite non-SIM active undergraduate students to join their team. For each member, indicate whether they are from SIM or another institution on the registration form.",
      },
      {
        question: "IS THERE A REGISTRATION FEE?",
        answer: "No. HackXperience 2026 is free to participate.",
      },
      {
        question: "WHO IS ELIGIBLE TO PARTICIPATE?",
        answer: "Active SIM students across foundations, diploma, undergraduate, and masters programmes are eligible. Active SIM students may also invite non-SIM active undergraduate students to join their team.",
      },
    ],
  },
  {
    label: "PRE-EVENTS",
    items: [
      {
        question: "WHAT ARE THE PRE-EVENTS?",
        answer: (
          <>
            The pre-hackathon workshop leading up to the main event:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Building Agentic AI: Microsoft Foundry Workshop</strong> · 17 July 2026, 6:00–10:00 PM @ {MICROSOFT_FOUNDRY_WORKSHOP.meta}</li>
            </ul>
          </>
        ),
      },
      {
        question: "WHAT IS THE MICROSOFT FOUNDRY WORKSHOP ABOUT?",
        answer: (
          <>
            A pre-hackathon workshop on <strong>17 July 2026, 6:00–10:00 PM</strong> at <strong>{MICROSOFT_FOUNDRY_WORKSHOP.meta}</strong>, covering agentic AI with Microsoft Foundry, including agent fundamentals, Foundry models and workflows, multi-agent design, hands-on agent builds, and responsible AI.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              {MICROSOFT_FOUNDRY_WORKSHOP.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </>
        ),
      },
      {
        question: "DO I NEED TO ATTEND THE PRE-EVENTS TO JOIN THE HACKATHON?",
        answer: "No, they are not mandatory but highly recommended.",
      },
    ],
  },
  {
    label: "MAIN EVENT",
    items: [
      {
        question: "WHEN AND WHERE IS THE HACKATHON?",
        answer: <>24–25 July 2026 on SIM Campus. See the full day-of schedule in the <a href="#timeline" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">Timeline</a> section.</>,
      },
      {
        question: "WHAT ARE THE TRACKS?",
        answer: REVEAL_TRACKS_AND_JUDGES ? (
          <>
            This year&apos;s theme is <strong>AI for Living</strong>. Teams choose one of two tracks: <strong>Care Forward</strong> (mental, physical, and nutrition wellbeing) or <strong>Friction To Flow</strong> (task management, work quality, and workflow automation). See the full track breakdown in the <a href="#tracks" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">Tracks section</a>.
          </>
        ) : (
          <>
            This year&apos;s theme is <strong>AI for Living</strong>. The full track breakdown and judging panel will be announced together at the pre-event Microsoft Foundry workshop on <strong>17 July 2026</strong>.
          </>
        ),
      },
      {
        question: "DO I NEED TO PICK A SUB-TRACK?",
        answer: REVEAL_TRACKS_AND_JUDGES
          ? "Sub-tracks (e.g. Mental Care, Workflow Automation) guide your build and are selected when you submit your project. They are starting points, and you're welcome to explore ideas within or across them."
          : "Sub-track details will be shared at the pre-event. You select your sub-track when you submit your project — they are starting points, and you're welcome to explore ideas within or across them.",
      },
      {
        question: "HOW DO I SUBMIT MY PROJECT?",
        answer: (
          <>
            Submit via the project portal at{" "}
            <a href="/submit" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">hackxperience2026.simitclub.com/submit</a>
            {" "}before <strong>25 July 2026, 12:00 PM SGT</strong> (strictly no late submissions). One submission per team. Include your GitHub repository and slide deck. Duplicate submissions are not allowed.
          </>
        ),
      },
      {
        question: "WHAT ARE THE GOLDEN RULES?",
        answer: (
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Fairness:</strong> all code must be written during the hackathon; brainstorming beforehand is allowed, but no pre-coded work.</li>
            <li><strong>Presence:</strong> at least one team member must be physically present throughout so you don&apos;t miss announcements.</li>
            <li><strong>Timing:</strong> all work must be finalised by the submission deadline; no coding after submission.</li>
            <li><strong>Ethical work:</strong> avoid projects that promote harm, discrimination, or unsafe use of AI.</li>
            <li><strong>Inclusivity:</strong> mutual respect and support; no offensive language, bullying, or abusive behaviour.</li>
          </ul>
        ),
      },
    ],
  },
  {
    label: "GENERAL",
    items: [
      {
        question: "WHAT ARE THE PRIZES?",
        answer: REVEAL_TRACKS_AND_JUDGES ? (
          <>
            Prize pool {PRIZE_POOL_WORTH} (all amounts in SGD): track winners and runner-ups (S$300 / S$150 each), sponsor awards including Best Use of Microsoft Stack (S$700), Best Entrepreneurial Award (S$100), Community Choice (S$50), and an informal Game Prize (S$50, details TBC). See the full breakdown in the <a href="#prizes" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">Prizes section</a>.
          </>
        ) : (
          <>
            Prize pool {PRIZE_POOL_WORTH} (all amounts in SGD): track winners and runner-ups (S$300 / S$150 each per track), sponsor awards including Best Use of Microsoft Stack (S$700), Best Entrepreneurial Award (S$100), Community Choice (S$50), and an informal Game Prize (S$50, details TBC). Tracks and judges announced at the pre-event on 17 July 2026. See the full breakdown in the <a href="#prizes" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">Prizes section</a>.
          </>
        ),
      },
      {
        question: "WHAT IS HACKXPERIENCE?",
        answer: "HackXperience is SIM IT Club's flagship hackathon, a 24-hour sprint where curious students build and deploy agentic products. In 2025, it brought together 90+ participants across 20 projects and won SIM's Outstanding Event Award (Silver).",
      },
      {
        question: "HOW MANY PARTICIPANTS ARE EXPECTED?",
        answer: "100+ students across multiple teams.",
      },
      {
        question: "I HAVE MORE QUESTIONS. WHO DO I CONTACT?",
        answer: (
          <>
            Email us at{" "}
            <a href="mailto:it@mymail.sim.edu.sg" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">it@mymail.sim.edu.sg</a>
            {" "}or PM{" "}
            <a href="https://web.telegram.org/k/#@FukutaroJFS" target="_blank" rel="noopener noreferrer" className="text-[#c00000] underline underline-offset-2 hover:text-[#a00000]">@FukutaroJFS</a>
            {" "}on Telegram.
          </>
        ),
      },
    ],
  },
  ];
}

function FaqAccordionItem({
  itemKey,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  itemKey: string;
  question: string;
  answer: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <HoverLift
      className="border border-[#d5d0c8] rounded-sm bg-white/40"
      lift={-3}
      style={{ boxShadow: isOpen ? "4px 4px 0 0 #c00000" : "none" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 cursor-pointer text-left"
      >
        <span className="min-w-0 text-[13px] sm:text-[15px] font-semibold tracking-[0.04em] text-[#1d1c17]">
          &gt; {question}
        </span>
        <motion.svg
          className="w-5 h-5 flex-shrink-0 text-[#1d1c17]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={itemKey}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 text-[13px] sm:text-[14px] leading-[1.7] text-[#1d1c17]/70 tracking-[0.02em]">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </HoverLift>
  );
}

export default function Faq() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const FAQ_DATA = buildFaqData();

  const toggle = (key: string) => {
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <section id="faq" className={`${ibmPlexMono.className} w-full bg-[#f2ede5] py-16 sm:py-24 px-6 sm:px-10 scroll-mt-11`}>
      <div className="mx-auto max-w-4xl">
        <h2 className={`${montserrat.className} text-[28px] sm:text-[36px] md:text-[42px] font-extrabold tracking-tight text-[#1d1c17] mb-10 sm:mb-14`}>
          FAQ_QUERY_MODULE
        </h2>

        <div className="flex flex-col gap-10 sm:gap-12">
          {FAQ_DATA.map((category) => (
            <div key={category.label}>
              <RevealItem>
                <div className="mb-4 sm:mb-5">
                  <span className="text-[11px] sm:text-[12px] font-bold tracking-[0.12em] text-[#c00000] uppercase">
                    // {category.label}
                  </span>
                </div>
              </RevealItem>

              <RevealStagger className="flex flex-col gap-3" stagger={0.06}>
                {category.items.map((item, i) => {
                  const key = `${category.label}-${i}`;
                  return (
                    <RevealItem key={key}>
                      <FaqAccordionItem
                        itemKey={key}
                        question={item.question}
                        answer={item.answer}
                        isOpen={openKey === key}
                        onToggle={() => toggle(key)}
                      />
                    </RevealItem>
                  );
                })}
              </RevealStagger>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
