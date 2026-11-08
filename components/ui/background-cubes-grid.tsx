"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BackgroundCubesGridProps {
  className?: string;
  gridSize?: number;
  baseColor?: string;
  glowColor?: string;
}

export function BackgroundCubesGrid({
  className,
  gridSize = 16,
  baseColor = "rgba(15, 23, 42, 0.4)",
  glowColor = "rgba(14, 165, 233, 0.35)",
}: BackgroundCubesGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      const cols = 24;
      const rows = 14;
      const spacingX = width / cols;
      const spacingY = height / rows;
      const cubeSize = Math.min(spacingX, spacingY) * 0.55;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const cx = (i + 0.5) * spacingX;
          const cy = (j + 0.5) * spacingY;

          // Distance from mouse
          const dx = mouseRef.current.x - cx;
          const dy = mouseRef.current.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 200;

          // Interactive elevation
          let elevation = 0;
          if (mouseRef.current.active && dist < maxDist) {
            elevation = Math.cos((dist / maxDist) * Math.PI * 0.5) * 18;
          }

          // Ambient idle wave
          const wave = Math.sin(time + (i * 0.3) + (j * 0.4)) * 6;
          const totalY = cy - elevation - wave;

          // Proximity glow
          const glowFactor = Math.max(0, 1 - dist / maxDist);
          const isGlow = mouseRef.current.active && dist < maxDist;

          ctx.save();
          ctx.translate(cx, totalY);

          // Top face (Rhombus in 2.5D isometric projection)
          ctx.beginPath();
          ctx.moveTo(0, -cubeSize * 0.5);
          ctx.lineTo(cubeSize * 0.86, 0);
          ctx.lineTo(0, cubeSize * 0.5);
          ctx.lineTo(-cubeSize * 0.86, 0);
          ctx.closePath();

          ctx.fillStyle = isGlow
            ? `rgba(56, 189, 248, ${0.15 + glowFactor * 0.4})`
            : `rgba(30, 41, 59, ${0.25 + (wave + 6) / 40})`;
          ctx.strokeStyle = isGlow
            ? `rgba(56, 189, 248, ${0.3 + glowFactor * 0.6})`
            : "rgba(51, 65, 85, 0.25)";
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();

          // Left face
          ctx.beginPath();
          ctx.moveTo(-cubeSize * 0.86, 0);
          ctx.lineTo(0, cubeSize * 0.5);
          ctx.lineTo(0, cubeSize * 1.1);
          ctx.lineTo(-cubeSize * 0.86, cubeSize * 0.6);
          ctx.closePath();
          ctx.fillStyle = isGlow
            ? `rgba(14, 165, 233, ${0.1 + glowFactor * 0.25})`
            : "rgba(15, 23, 42, 0.3)";
          ctx.strokeStyle = isGlow
            ? `rgba(56, 189, 248, ${0.2 + glowFactor * 0.4})`
            : "rgba(51, 65, 85, 0.15)";
          ctx.fill();
          ctx.stroke();

          // Right face
          ctx.beginPath();
          ctx.moveTo(0, cubeSize * 0.5);
          ctx.lineTo(cubeSize * 0.86, 0);
          ctx.lineTo(cubeSize * 0.86, cubeSize * 0.6);
          ctx.lineTo(0, cubeSize * 1.1);
          ctx.closePath();
          ctx.fillStyle = isGlow
            ? `rgba(2, 132, 199, ${0.12 + glowFactor * 0.3})`
            : "rgba(15, 23, 42, 0.4)";
          ctx.strokeStyle = isGlow
            ? `rgba(56, 189, 248, ${0.2 + glowFactor * 0.4})`
            : "rgba(51, 65, 85, 0.15)";
          ctx.fill();
          ctx.stroke();

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gridSize, baseColor, glowColor]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-auto", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-65 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_85%)]"
      />
    </div>
  );
}
