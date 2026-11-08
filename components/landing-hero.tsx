"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, ShoppingBag, ArrowRight, CheckCircle2 } from "lucide-react";
import { BackgroundCubesGrid } from "@/components/ui/background-cubes-grid";

type Platform = {
  word: string;
  bg: string;
  logoUrl: string;
};

const platforms: Platform[] = [
  { word: "PayPal", bg: "#003087", logoUrl: "/logos/clean/paypal.png" },
  { word: "Channel3", bg: "#0284c7", logoUrl: "/logos/clean/channel3.png" },
  { word: "AG Grid", bg: "#1e293b", logoUrl: "/logos/clean/aggrid.png" },
  { word: "Render", bg: "#111827", logoUrl: "/logos/clean/render.png" },
];

const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const STAGGER = 0.09;
const START = 0.12;

function InlinePill({ platform, delay }: { platform: Platform; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
      className="inline-flex translate-y-[-0.06em] items-center gap-[0.38em] rounded-full py-[0.14em] pr-[0.55em] pl-[0.16em] align-middle leading-none bg-white text-slate-900 border border-slate-200/90 shadow-[0_2px_14px_rgba(0,0,0,0.35)] transition duration-200 hover:scale-105 hover:shadow-xl cursor-default"
    >
      <span
        className="inline-flex size-[1.25em] items-center justify-center rounded-full overflow-hidden bg-slate-50 ring-1 ring-slate-200/80 p-[0.16em] shrink-0 shadow-inner"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={platform.logoUrl}
          alt={platform.word}
          className="size-full object-contain"
        />
      </span>
      <span className="font-semibold text-[0.88em] tracking-tight text-slate-900 select-none">
        {platform.word}
      </span>
    </motion.span>
  );
}

export function LandingHero() {
  const reduceMotion = useReducedMotion();
  const [paypal, channel3, agGrid, renderPlatform] = platforms;

  const pill = (p: Platform, hasComma = false): ReactNode => (
    <span className="inline-flex items-baseline whitespace-nowrap mx-[0.1em]">
      <InlinePill platform={p} delay={START + platforms.indexOf(p) * STAGGER} />
      {hasComma && (
        <span className="text-[0.62em] font-normal text-slate-400 select-none ml-[0.04em] mr-[0.16em] translate-y-[-0.06em]">
          ,
        </span>
      )}
    </span>
  );

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE_OUT, delay },
  });

  return (
    <div className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-16 sm:py-24 sm:px-8 bg-[#060c18] font-sans">
      {/* 3D Interactive Perspective Cubes Grid */}
      <BackgroundCubesGrid className="-z-10" />

      {/* Ambient Gradient Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-gradient-to-tr from-sky-500/12 via-violet-600/12 to-teal-500/12 blur-[130px] pointer-events-none -z-10" />

      <div className="pointer-events-none mx-auto flex max-w-[1100px] flex-col items-center text-center antialiased">
        {/* Dynamic Sponsor Headline - Modern Professional Sans-Serif */}
        <h1 className="max-w-[26ch] text-[clamp(32px,4.8vw,62px)] leading-[1.3] font-bold tracking-[-0.03em] text-balance text-white font-sans">
          Simulate, shop, and transact across {pill(paypal, true)} {pill(channel3, true)} {pill(agGrid, true)} and {pill(renderPlatform)} before you spend.
        </h1>

        {/* Subtitle */}
        <motion.p
          {...fadeUp(0.4)}
          className="mt-6 max-w-[680px] text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-pretty text-slate-400 font-sans"
        >
          Guardian Copilot is an autonomous financial agent for PayPal. Protect your sacred{" "}
          <strong className="text-emerald-400 font-semibold">$500 safety buffer floor</strong>, discover live multi-merchant deals on Channel3, and evaluate cash flow with interactive AG Grid tables.
        </motion.p>

        {/* Two Call-to-Action Buttons */}
        <motion.div
          {...fadeUp(0.6)}
          className="pointer-events-auto mt-9 flex flex-col items-center gap-3.5 sm:flex-row w-full sm:w-auto justify-center"
        >
          {/* Button 1: Go to Storefront */}
          <Link
            href="/storefront"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 shadow-lg transition active:scale-95 group cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <span>Go to Storefront</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Button 2: Go to Chat Copilot */}
          <Link
            href="/copilot"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-950/40 border border-violet-500/40 transition active:scale-95 group"
          >
            <Sparkles className="w-4 h-4 text-violet-200 group-hover:rotate-12 transition-transform" />
            <span>Go to Chat Copilot</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-400/25 text-violet-200 border border-violet-400/30">
              AI AGENT
            </span>
          </Link>
        </motion.div>

        {/* Features / Guarantee Micro-pills */}
        <motion.div
          {...fadeUp(0.75)}
          className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[12px] text-slate-500 font-sans"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protected $500 Safety Floor</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Channel3 25,000+ Retail Catalogs</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>PayPal REST v2 Sandbox Ready</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
