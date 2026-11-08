"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, ShoppingBag, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundCubesGrid } from "@/components/ui/background-cubes-grid";

type Platform = {
  word: string;
  bg: string;
  fg: string;
  logoUrl: string;
};

const platforms: Platform[] = [
  { word: "PayPal", bg: "#003087", fg: "#fff", logoUrl: "/logos/PayPal.png" },
  { word: "Channel3", bg: "#0284c7", fg: "#fff", logoUrl: "/logos/Channel3.png" },
  { word: "AG Grid", bg: "#1e293b", fg: "#fff", logoUrl: "/logos/AGGrid.png" },
  { word: "Render", bg: "#111827", fg: "#fff", logoUrl: "/logos/Render.png" },
];

const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const STAGGER = 0.09;
const START = 0.15;

function InlinePill({ platform, delay }: { platform: Platform; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
      className="mx-[0.08em] inline-flex translate-y-[-0.06em] items-center gap-[0.32em] rounded-full py-[0.1em] pr-[0.5em] pl-[0.14em] align-middle leading-none bg-slate-900/90 text-white border border-slate-700/80 shadow-[0_0_12px_rgba(0,0,0,0.5)] transition hover:border-slate-500"
    >
      <span
        className="inline-flex size-[1.05em] items-center justify-center rounded-full overflow-hidden p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
        style={{ backgroundColor: platform.bg }}
      >
        <img
          src={platform.logoUrl}
          alt={platform.word}
          className="size-full object-contain"
          onError={(e) => {
            // fallback if image not loaded
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </span>
      <span className="font-semibold text-[0.88em] tracking-tight">{platform.word}</span>
    </motion.span>
  );
}

export function LandingHero({
  onScrollToStorefront,
}: {
  onScrollToStorefront?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [paypal, channel3, agGrid, renderPlatform] = platforms;

  const pill = (p: Platform, suffix = ""): ReactNode => (
    <span className="whitespace-nowrap">
      <InlinePill platform={p} delay={START + platforms.indexOf(p) * STAGGER} />
      {suffix}
    </span>
  );

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE_OUT, delay },
  });

  return (
    <div className="relative isolate flex min-h-[46rem] w-full items-center justify-center overflow-hidden px-4 py-20 sm:py-28 sm:px-8 bg-[#060c18] border-b border-slate-800/80">
      {/* 3D Interactive Perspective Cubes Grid */}
      <BackgroundCubesGrid className="-z-10" />

      {/* Ambient Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-sky-500/10 via-violet-600/10 to-teal-500/10 blur-[120px] pointer-events-none -z-10" />

      <div className="pointer-events-none mx-auto flex max-w-[1080px] flex-col items-center text-center antialiased">
        {/* Top Floating Badge */}
        <motion.div
          {...fadeUp(0.1)}
          className="pointer-events-auto mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300 shadow-md backdrop-blur"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-200">PayPal Agent Hackathon 2026</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-mono text-[11px] font-semibold">Autonomous Commerce</span>
        </motion.div>

        {/* Dynamic Sponsor Headline */}
        <h1 className="max-w-[25ch] text-[clamp(32px,4.8vw,60px)] leading-[1.3] font-bold tracking-[-0.03em] text-balance text-white">
          Simulate, shop, and transact across {pill(paypal, ",")} {pill(channel3, ",")} {pill(agGrid, ",")} and {pill(renderPlatform)} before you spend.
        </h1>

        {/* Executive Subtitle */}
        <motion.p
          {...fadeUp(0.6)}
          className="mt-6 max-w-[660px] text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-pretty text-slate-400"
        >
          Guardian Copilot is an autonomous financial agent for PayPal. Protect your sacred <strong className="text-emerald-400 font-semibold">$500 safety buffer floor</strong>, discover live multi-merchant deals on Channel3, and evaluate cash flow with interactive AG Grid tables.
        </motion.p>

        {/* Two Call-to-Action Buttons */}
        <motion.div
          {...fadeUp(0.75)}
          className="pointer-events-auto mt-8 flex flex-col items-center gap-3.5 sm:flex-row w-full sm:w-auto justify-center"
        >
          {/* Button 1: Go to Storefront */}
          <button
            type="button"
            onClick={() => {
              if (onScrollToStorefront) {
                onScrollToStorefront();
              } else {
                const el = document.getElementById("storefront-stage");
                el?.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 shadow-lg transition active:scale-95 group cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <span>Go to Storefront</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>

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
          {...fadeUp(0.9)}
          className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[12px] text-slate-500"
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
            <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
            <span>PayPal REST v2 Sandbox Ready</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
