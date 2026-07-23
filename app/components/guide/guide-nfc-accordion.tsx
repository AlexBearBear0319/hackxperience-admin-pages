"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IBM_Plex_Mono } from "next/font/google";
import { GUIDE_NFC_REWRITE_STEPS } from "@/lib/guide-content";
import { DARK_BG, MUTED, SHADOW_SM, WHITE } from "./guide-tokens";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function GuideNfcAccordion() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="border-2"
      style={{
        borderColor: DARK_BG,
        backgroundColor: WHITE,
        boxShadow: open ? SHADOW_SM : "none",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${ibmPlexMono.className} w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left cursor-pointer`}
        aria-expanded={open}
      >
        <motion.svg
          className="w-4 h-4 shrink-0"
          style={{ color: DARK_BG }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </motion.svg>
        <span
          className="text-[11px] sm:text-[12px] font-bold tracking-wide uppercase"
          style={{ color: DARK_BG }}
        >
          How to rewrite
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 sm:px-5 pb-4 text-sm leading-relaxed"
              style={{ color: MUTED }}
            >
              <ol className="list-decimal pl-4 space-y-1.5">
                {GUIDE_NFC_REWRITE_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
