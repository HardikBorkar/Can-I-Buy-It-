"use client";

import * as React from "react";
import { LandingHero } from "@/components/landing-hero";

export default function HomePage() {
  return (
    <main className="min-h-screen w-full flex flex-col bg-[#04060c] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      <LandingHero />
    </main>
  );
}
