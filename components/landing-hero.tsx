"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ShoppingBag, ArrowRight, CheckCircle2 } from "lucide-react";

type Platform = {
  word: string;
  logoUrl: string;
  wrapperClass: string;
  imgClass: string;
};

const platforms: Platform[] = [
  {
    word: "PayPal",
    logoUrl: "/logos/clean/paypal-square.png",
    wrapperClass: "size-8 rounded-lg overflow-hidden shadow-md shadow-blue-950/60 shrink-0",
    imgClass: "size-full object-cover",
  },
  {
    word: "Channel3",
    logoUrl: "/logos/clean/channel3.png",
    wrapperClass: "size-8 flex items-center justify-center shrink-0",
    imgClass: "size-7 object-contain invert",
  },
  {
    word: "AG Grid",
    logoUrl: "/logos/clean/aggrid.png",
    wrapperClass: "size-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-md shrink-0",
    imgClass: "size-full object-contain",
  },
  {
    word: "Render",
    logoUrl: "/logos/clean/render.png",
    wrapperClass: "size-8 flex items-center justify-center shrink-0",
    imgClass: "size-7 object-contain invert",
  },
];

const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: EASE_OUT, delay },
  });

  return (
    <div className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-16 sm:py-24 sm:px-8 bg-[#04060c] font-sans">
      {/* Diagonal Spotlight Beam */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-[-15%] -z-10 h-[145vh] w-[145vw] opacity-90 sm:-top-32 sm:-left-10"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 3787 2842"
        fill="none"
      >
        <g filter="url(#hero-spotlight-blur)">
          <ellipse
            cx="1924.71"
            cy="273.501"
            rx="1924.71"
            ry="273.501"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill="url(#hero-spotlight-grad)"
            fillOpacity="0.32"
          />
        </g>
        <defs>
          <filter
            id="hero-spotlight-blur"
            x="0.860352"
            y="0.838989"
            width="3785.16"
            height="2840.26"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
          </filter>
          <linearGradient id="hero-spotlight-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
      </svg>

      {/* Soft Top-Left Radial Spotlight Ambient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_65%_55%_at_25%_20%,rgba(59,130,246,0.16),rgba(67,56,202,0.08)_45%,transparent_75%)]"
      />

      <div className="mx-auto flex max-w-[1040px] flex-col items-center text-center antialiased">
        {/* Main Spotlight Headline */}
        <motion.h1
          {...fadeUp(0.05)}
          className="max-w-[22ch] bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-[clamp(34px,5vw,60px)] leading-[1.12] font-bold tracking-[-0.03em] text-balance text-transparent font-sans"
        >
          Simulate, shop, and transact before you spend.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...fadeUp(0.18)}
          className="mt-5 max-w-[660px] text-[clamp(14px,1.35vw,17px)] leading-[1.6] text-pretty text-slate-400 font-sans"
        >
          Guardian Copilot is an autonomous financial agent for PayPal. Protect your sacred{" "}
          <strong className="text-emerald-400 font-semibold">$500 safety buffer floor</strong>, discover live multi-merchant deals on Channel3, and evaluate cash flow with interactive AG Grid tables.
        </motion.p>

        {/* Spotlight Brand Logos (Icon + White Wordmark Format) */}
        <motion.div
          {...fadeUp(0.32)}
          className="mt-12 grid grid-cols-2 sm:grid-cols-4 items-center justify-items-center gap-x-10 gap-y-8 sm:gap-x-14"
        >
          {platforms.map((platform) => (
            <div
              key={platform.word}
              className="flex items-center gap-3 select-none opacity-90 hover:opacity-100 transition-opacity duration-200"
            >
              <span className={platform.wrapperClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={platform.logoUrl}
                  alt={platform.word}
                  className={platform.imgClass}
                />
              </span>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {platform.word}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Two Call-to-Action Buttons */}
        <motion.div
          {...fadeUp(0.46)}
          className="mt-12 flex flex-col items-center gap-3.5 sm:flex-row w-full sm:w-auto justify-center"
        >
          {/* Button 1: Go to Storefront */}
          <Link
            href="/storefront"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 shadow-lg transition active:scale-95 group cursor-pointer"
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
          {...fadeUp(0.6)}
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
