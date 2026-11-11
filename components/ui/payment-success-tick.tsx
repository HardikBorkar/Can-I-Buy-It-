"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Check, Sparkles } from "lucide-react";

interface PaymentSuccessTickProps {
  amount?: number;
  currency?: string;
  item?: string;
  recipient?: string;
  orderId?: string;
  statusLabel?: string;
  onDone?: () => void;
  autoPlaySound?: boolean;
  compact?: boolean;
}

const circumference = 2 * Math.PI * 72; // r = 72

// Synthesizes the iconic, satisfying Google Pay / UPI ascending chord chime via Web Audio API
function playUpiSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dual-tone ascending harmonic chords: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      // Smooth attack and pleasant exponential acoustic decay
      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.65);
    });
  } catch {
    // Audio autoplay policy; ignore if blocked
  }
}

export function PaymentSuccessTick({
  amount,
  currency = "USD",
  item,
  recipient,
  orderId,
  statusLabel = "Payment Successful",
  onDone,
  autoPlaySound = true,
  compact = false,
}: PaymentSuccessTickProps) {
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    // Haptic pulse for mobile and touch devices
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }
    } catch {}

    // Audio chime
    if (autoPlaySound) {
      const timer = setTimeout(() => {
        playUpiSound();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoPlaySound]);

  return (
    <div className={`relative flex flex-col items-center justify-center text-center select-none ${compact ? "p-3 space-y-2.5" : "p-5 sm:p-6 space-y-4"}`}>
      {/* Background Soft Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* The Iconic GPay / UPI Animated Dial */}
      <div className="relative flex items-center justify-center" style={{ width: compact ? 120 : 160, height: compact ? 120 : 160 }}>
        {/* Ripple Shockwave 1 */}
        <motion.div
          className="absolute rounded-full border-2 border-emerald-400/40 pointer-events-none"
          initial={{ width: compact ? 80 : 100, height: compact ? 80 : 100, scale: 0.7, opacity: 0.9 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Ripple Shockwave 2 (Outer Ambient Wave) */}
        <motion.div
          className="absolute rounded-full border border-teal-400/30 pointer-events-none"
          initial={{ width: compact ? 80 : 100, height: compact ? 80 : 100, scale: 0.7, opacity: 0.8 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ delay: 0.35, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Outer Circular SVG Progress Track */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={compact ? "120" : "160"}
          height={compact ? "120" : "160"}
          viewBox="0 0 160 160"
          aria-hidden="true"
        >
          {/* Subtle Background Track */}
          <circle
            cx="80"
            cy="80"
            r="72"
            fill="none"
            stroke="#1e293b"
            strokeWidth="5"
            opacity="0.4"
          />

          {/* Smooth Animated Green Progress Ring */}
          <motion.circle
            cx="80"
            cy="80"
            r="72"
            fill="none"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </svg>

        {/* Inner Solid Green Disc with Pop Spring */}
        <motion.div
          className={`rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.45)] z-10 ${
            compact ? "w-20 h-20" : "w-28 h-28"
          }`}
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 18,
            delay: 0.1,
          }}
        >
          {/* Animated Spring-Drawn Checkmark */}
          <svg
            className={compact ? "w-10 h-10" : "w-14 h-14"}
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <motion.path
              d="M14 27 L23 36 L38 18"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { delay: 0.28, duration: 0.38, ease: [0.16, 1, 0.3, 1] },
                opacity: { delay: 0.28, duration: 0.05 },
              }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Confirmation Text & Details */}
      <motion.div
        className="space-y-1.5 z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
      >
        <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{statusLabel}</span>
        </div>

        {amount !== undefined && (
          <motion.div
            className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.42, type: "spring", stiffness: 350 }}
          >
            ${amount.toFixed(2)} <span className="text-base text-zinc-400 font-normal">{currency}</span>
          </motion.div>
        )}

        {item && (
          <p className="text-xs text-zinc-300 font-medium truncate max-w-xs mx-auto">
            {item}
          </p>
        )}

        {recipient && (
          <p className="text-[11px] text-zinc-400">
            Paid to <span className="text-zinc-200 font-medium">{recipient}</span>
          </p>
        )}
      </motion.div>

      {/* Verified Badges & Guardian Protection Footer */}
      <motion.div
        className="w-full max-w-xs pt-2 space-y-1.5 text-xs z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Safety Buffer Floor</span>
          </span>
          <span className="font-mono text-emerald-400 font-semibold">$500.00 Protected</span>
        </div>

        {orderId && (
          <div className="flex items-center justify-between px-1 text-[10px] text-zinc-500 font-mono">
            <span>PayPal Ref:</span>
            <span className="text-zinc-400 truncate max-w-[170px]">{orderId}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

