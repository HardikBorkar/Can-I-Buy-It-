"use client";

import React, { useEffect, useRef, useState } from "react";

export interface AsciiArtProps {
  src: string;
  resolution?: number;
  charset?: "standard" | "blocks" | "binary" | "dots" | "circles" | "dense" | string;
  color?: string;
  backgroundColor?: string;
  inverted?: boolean;
  colored?: boolean;
  animated?: boolean;
  animationStyle?: "fade" | "typewriter" | "matrix" | "none";
  animationDuration?: number;
  animateOnView?: boolean;
  className?: string;
}

const CHARSETS: Record<string, string> = {
  standard: " .:-=+*#%@",
  blocks: " ░▒▓█",
  binary: " 01",
  dots: " ·:;*oO08@",
  circles: " ◦○◎◉●",
  dense: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

export function AsciiArt({
  src,
  resolution = 80,
  charset = "standard",
  color = "#0079C1",
  backgroundColor = "transparent",
  inverted = false,
  colored = false,
  animated = true,
  animationStyle = "fade",
  animationDuration = 1.5,
  animateOnView = false,
  className = "",
}: AsciiArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [asciiLines, setAsciiLines] = useState<string[]>([]);
  const [coloredGrid, setColoredGrid] = useState<{ char: string; color: string }[][]>([]);
  const [isVisible, setIsVisible] = useState(!animateOnView);
  const [renderedProgress, setRenderedProgress] = useState(animated ? 0 : 1);

  // Intersection observer for animateOnView
  useEffect(() => {
    if (!animateOnView) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [animateOnView]);

  // Image to ASCII processor
  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (isCancelled) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Monospace characters are roughly 2x taller than wide
      const charAspect = 0.5;
      const width = Math.max(20, Math.min(resolution, 140));
      const height = Math.round(width * (img.naturalHeight / img.naturalWidth) * charAspect);

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const { data } = imgData;

        const charString = typeof charset === "string" && CHARSETS[charset] ? CHARSETS[charset] : charset;
        const chars = inverted ? charString.split("").reverse().join("") : charString;

        const lines: string[] = [];
        const colorMatrix: { char: string; color: string }[][] = [];

        for (let y = 0; y < height; y++) {
          let lineStr = "";
          const colorRow: { char: string; color: string }[] = [];

          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            if (a < 30) {
              lineStr += " ";
              colorRow.push({ char: " ", color: "transparent" });
              continue;
            }

            // Luminance
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const charIdx = Math.min(chars.length - 1, Math.floor(brightness * chars.length));
            const char = chars[charIdx] || " ";

            lineStr += char;
            colorRow.push({
              char,
              color: colored ? `rgba(${r}, ${g}, ${b}, ${a / 255})` : color,
            });
          }

          lines.push(lineStr);
          colorMatrix.push(colorRow);
        }

        setAsciiLines(lines);
        setColoredGrid(colorMatrix);
      } catch (err) {
        console.warn("Could not read canvas data for ASCII conversion (CORS fallback):", err);
        // Fallback procedural ASCII logo for PayPal
        const fallbackLines = [
          "      .::--====--::.       ",
          "    :+=+**###%%%%##*+-.    ",
          "   *#%@@@@@@@@@@@@@@%#*    ",
          "  +#@@@@@%#****#%@@@@@#+   ",
          "  #@@@@@+        *@@@@@#   ",
          "  #@@@@@+        *@@@@@#   ",
          "  +#@@@@@%#****#%@@@@@#+   ",
          "   *#%@@@@@@@@@@@@@@%#*    ",
          "    :+=+**###%%%%##*+-.    ",
          "      .::--====--::.       ",
        ];
        setAsciiLines(fallbackLines);
      }
    };

    img.onerror = () => {
      // Fallback PayPal P Monogram
      setAsciiLines([
        "  ██████╗  ██████╗ ",
        "  ██╔══██╗ ██╔══██╗",
        "  ██████╔╝ ██████╔╝",
        "  ██╔═══╝  ██╔═══╝ ",
        "  ██║      ██║     ",
        "  ╚═╝      ╚═╝     ",
      ]);
    };

    img.src = src;

    return () => {
      isCancelled = true;
    };
  }, [src, resolution, charset, color, inverted, colored]);

  // Handle animation style
  useEffect(() => {
    if (!isVisible || !animated || animationStyle === "none") {
      setRenderedProgress(1);
      return;
    }

    if (animationStyle === "fade") {
      setRenderedProgress(1);
      return;
    }

    if (animationStyle === "typewriter") {
      setRenderedProgress(0);
      let p = 0;
      const totalSteps = asciiLines.length || 20;
      const stepTime = (animationDuration * 1000) / totalSteps;

      const interval = setInterval(() => {
        p += 1 / totalSteps;
        if (p >= 1) {
          setRenderedProgress(1);
          clearInterval(interval);
        } else {
          setRenderedProgress(p);
        }
      }, stepTime);

      return () => clearInterval(interval);
    }
  }, [isVisible, animated, animationStyle, animationDuration, asciiLines.length]);

  const visibleLineCount = Math.max(1, Math.round(asciiLines.length * renderedProgress));

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden font-mono flex items-center justify-center ${className}`}
      style={{ backgroundColor }}
    >
      <pre
        className="leading-[0.8] tracking-[-0.05em] text-center font-mono font-bold transition-opacity duration-1000"
        style={{
          color,
          fontSize: "clamp(6px, 1.1vw, 12px)",
          opacity: isVisible ? (animationStyle === "fade" ? 1 : renderedProgress > 0 ? 1 : 0) : 0,
          transition: `opacity ${animationDuration}s ease-in-out`,
        }}
      >
        {colored
          ? coloredGrid.slice(0, visibleLineCount).map((row, y) => (
              <div key={y} className="whitespace-pre">
                {row.map((cell, x) => (
                  <span key={x} style={{ color: cell.color }}>
                    {cell.char}
                  </span>
                ))}
              </div>
            ))
          : asciiLines.slice(0, visibleLineCount).join("\n")}
      </pre>
    </div>
  );
}

