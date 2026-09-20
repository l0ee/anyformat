import React, { useEffect, useRef } from 'react';

export interface VectorBackgroundProps {
  className?: string;
  enabled?: boolean;
  nodeCount?: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export const VectorBackground: React.FC<VectorBackgroundProps> = ({
  className = '',
  enabled = true,
  nodeCount = 32,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isDestroyed = false;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Palette: rose, pink, and indigo to align with AnyFormat's brand
    const colors = [
      'rgba(244, 63, 94, ',   // rose-500
      'rgba(236, 72, 153, ',  // pink-500
      'rgba(99, 102, 241, ',  // indigo-500
      'rgba(168, 85, 247, ',  // purple-500
    ];

    const nodes: Node[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: 1.5 + Math.random() * 1.5,
        color: colors[i % colors.length],
      });
    }

    const resize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const render = () => {
      if (isDestroyed) return;

      const isDark = document.documentElement.classList.contains('dark');
      const baseAlpha = isDark ? 0.28 : 0.16;
      const lineAlphaFactor = isDark ? 0.22 : 0.12;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw flowing background Bézier wave ribbons
      t += 0.004;
      const waveCount = 2;
      for (let w = 0; w < waveCount; w++) {
        const offset = w * 1.5;
        ctx.beginPath();
        const startY = height * (0.25 + w * 0.35) + Math.sin(t + offset) * 35;
        const endY = height * (0.35 + w * 0.35) + Math.cos(t + offset) * 35;
        const cp1x = width * 0.3;
        const cp1y = startY + Math.sin(t * 1.2 + offset) * 80;
        const cp2x = width * 0.7;
        const cp2y = endY - Math.cos(t * 1.1 + offset) * 80;

        ctx.moveTo(0, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, width, endY);
        ctx.strokeStyle = `${colors[w % colors.length]}${baseAlpha * 0.75})`;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      // 2. Draw connecting vector network lines
      const maxDistance = 140;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * lineAlphaFactor;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = isDark
              ? `rgba(226, 232, 240, ${alpha})`
              : `rgba(100, 116, 139, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // 3. Draw vector anchor points and handles
      for (const node of nodes) {
        // Point
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}${baseAlpha * 1.5})`;
        ctx.fill();

        // Subtle anchor coordinate ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}${baseAlpha * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < 0) node.x = width;
          else if (node.x > width) node.x = 0;
          if (node.y < 0) node.y = height;
          else if (node.y > height) node.y = 0;
        }
      }

      if (!prefersReducedMotion && !document.hidden) {
        frameRef.current = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !prefersReducedMotion && !frameRef.current) {
        frameRef.current = requestAnimationFrame(render);
      } else if (document.hidden && frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    render();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDestroyed = true;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [enabled, nodeCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-700 ${className}`}
    />
  );
};

export default VectorBackground;
