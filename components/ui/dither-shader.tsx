"use client";

import React, { useEffect, useRef } from "react";

export interface DitherShaderProps {
  src: string;
  gridSize?: number;
  ditherMode?: "bayer" | "ordered" | "noise";
  colorMode?: "grayscale" | "monochrome" | "duotone";
  invert?: boolean;
  animated?: boolean;
  animationSpeed?: number;
  primaryColor?: string;
  secondaryColor?: string;
  threshold?: number;
  className?: string;
}

// 4x4 Bayer Dithering Matrix
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function DitherShader({
  src,
  gridSize = 2,
  ditherMode = "bayer",
  colorMode = "grayscale",
  invert = false,
  animated = false,
  animationSpeed = 0.02,
  primaryColor = "#001435",
  secondaryColor = "#0079C1",
  threshold = 0.5,
  className = "",
}: DitherShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    let offset = 0;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const render = () => {
        const w = canvas.width;
        const h = canvas.height;

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        for (let y = 0; y < h; y += gridSize) {
          for (let x = 0; x < w; x += gridSize) {
            const idx = (y * w + x) * 4;
            let r = data[idx];
            let g = data[idx + 1];
            let b = data[idx + 2];

            let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (invert) lum = 1.0 - lum;

            const bayerVal = (BAYER_4X4[(y + Math.floor(offset)) % 4][(x + Math.floor(offset)) % 4] / 16.0);
            const isBright = lum + (bayerVal - 0.5) * 0.5 > threshold;

            const outColor = isBright ? secondaryColor : primaryColor;

            // Fill grid block
            ctx.fillStyle = outColor;
            ctx.fillRect(x, y, gridSize, gridSize);
          }
        }

        if (animated) {
          offset += animationSpeed;
          animId = requestAnimationFrame(render);
        }
      };

      render();
    };

    img.src = src;

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [src, gridSize, ditherMode, colorMode, invert, animated, animationSpeed, primaryColor, secondaryColor, threshold]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={300}
      className={`block object-cover ${className}`}
    />
  );
}

