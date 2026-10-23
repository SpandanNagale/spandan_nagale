import { useEffect, useRef } from 'react';

type Mode = 'sphere' | 'wave';

interface GlyphFieldProps {
  mode: Mode;
  reducedMotion: boolean;
  className?: string;
}

type Tone = 'ink' | 'flow' | 'gate';

interface Glyph {
  x: number;
  y: number;
  z: number;
  ch: string;
  tone: Tone;
  weight: number; // 0..1, how prominent (nodes > edges > surface)
}

const SURFACE = ['│', '┤', '⊥', '·', '—', '·', '·'];
const NODE = ['○', '□'];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit sphere: faint surface glyphs, a sparse set of node glyphs, and short
 * great-circle arcs between neighbouring nodes so it reads as a graph. */
function buildSphere(): Glyph[] {
  const rand = mulberry32(7);
  const glyphs: Glyph[] = [];
  const surfaceCount = 520;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < surfaceCount; i++) {
    const y = 1 - (i / (surfaceCount - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    glyphs.push({
      x: Math.cos(th) * r,
      y,
      z: Math.sin(th) * r,
      ch: SURFACE[Math.floor(rand() * SURFACE.length)],
      tone: 'ink',
      weight: 0.15,
    });
  }

  const nodes: [number, number, number][] = [];
  while (nodes.length < 22) {
    const u = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const p: [number, number, number] = [Math.cos(t) * r, u, Math.sin(t) * r];
    if (nodes.every((n) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] < 0.86)) nodes.push(p);
  }

  nodes.forEach((n, i) => {
    // Nearest two neighbours get an arc of dots.
    const near = nodes
      .map((m, j) => ({ j, d: n[0] * m[0] + n[1] * m[1] + n[2] * m[2] }))
      .filter((o) => o.j > i)
      .sort((a, b) => b.d - a.d)
      .slice(0, 2);
    for (const { j, d } of near) {
      const m = nodes[j];
      const omega = Math.acos(Math.min(1, d));
      const steps = Math.max(4, Math.round(omega * 14));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const a = Math.sin((1 - t) * omega) / Math.sin(omega);
        const b = Math.sin(t * omega) / Math.sin(omega);
        glyphs.push({
          x: a * n[0] + b * m[0],
          y: a * n[1] + b * m[1],
          z: a * n[2] + b * m[2],
          ch: '·',
          tone: 'ink',
          weight: 0.45,
        });
      }
    }
  });

  nodes.forEach((n, i) => {
    const tone: Tone = i % 7 === 0 ? 'flow' : i % 11 === 3 ? 'gate' : 'ink';
    glyphs.push({ x: n[0], y: n[1], z: n[2], ch: NODE[i % 2], tone, weight: 1 });
  });

  return glyphs;
}

function readColors(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return {
    ink: cs.getPropertyValue('--text').trim() || '#0a0a0a',
    flow: cs.getPropertyValue('--flow').trim() || '#0f766e',
    gate: cs.getPropertyValue('--gate').trim() || '#b45309',
  };
}

/**
 * Canvas field of tiny monospace glyphs. `sphere` is the hero's slowly
 * rotating graph-globe with mouse parallax; `wave` is the contact CTA's
 * particle wave. Animation stops while offscreen or the tab is hidden, and
 * reduced motion draws a single static frame.
 */
export default function GlyphField({ mode, reducedMotion, className }: GlyphFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = readColors(canvas);
    const sphere = mode === 'sphere' ? buildSphere() : [];
    const projected = new Float32Array(sphere.length * 3);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let last = 0;
    let time = 0;
    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
    }

    function drawSphere() {
      const radius = Math.min(width, height) * 0.42;
      const cx = width / 2;
      const cy = height / 2;
      tilt.x += (pointer.y * 0.35 - tilt.x) * 0.05;
      tilt.y += (pointer.x * 0.5 - tilt.y) * 0.05;
      const ry = time * 0.00012 + tilt.y;
      const rx = -0.32 + tilt.x;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const base = Math.max(9, radius / 18);
      // Bucket by integer font size so ctx.font is set a handful of times per
      // frame rather than once per glyph.
      const buckets = new Map<number, number[]>();

      for (let i = 0; i < sphere.length; i++) {
        const g = sphere[i];
        const x1 = g.x * cosY + g.z * sinY;
        const z1 = -g.x * sinY + g.z * cosY;
        const y2 = g.y * cosX - z1 * sinX;
        const z2 = g.y * sinX + z1 * cosX;
        const depth = (z2 + 1) / 2; // 0 back .. 1 front
        const persp = 1 / (1.9 - z2 * 0.5);
        const alpha = (0.06 + depth * 0.8) * (0.35 + g.weight * 0.65);
        if (alpha < 0.04) continue;
        const size = Math.round(base * (0.7 + depth * 0.5) * (g.weight === 1 ? 1.25 : 1));
        projected[i * 3] = cx + x1 * radius * persp * 1.4;
        projected[i * 3 + 1] = cy + y2 * radius * persp * 1.4;
        projected[i * 3 + 2] = Math.min(1, alpha);
        let list = buckets.get(size);
        if (!list) buckets.set(size, (list = []));
        list.push(i);
      }

      for (const [size, list] of buckets) {
        ctx!.font = `${size}px "JetBrains Mono", monospace`;
        for (const i of list) {
          const g = sphere[i];
          ctx!.globalAlpha = projected[i * 3 + 2];
          ctx!.fillStyle = g.tone === 'ink' ? colors.ink : colors[g.tone];
          ctx!.fillText(g.ch, projected[i * 3], projected[i * 3 + 1]);
        }
      }
    }

    function drawWave() {
      const step = 14;
      const cols = Math.ceil(width / step) + 1;
      const rows = Math.ceil(height / step) + 1;
      ctx!.font = '11px "JetBrains Mono", monospace';
      const t = time * 0.0006;
      for (let c = 0; c < cols; c++) {
        // Fade in from the left so the wave hugs the right edge.
        const edge = Math.pow(c / cols, 1.6);
        for (let r = 0; r < rows; r++) {
          const x = c * step;
          const yBase = r * step;
          const h = Math.sin(c * 0.22 + t) * Math.cos(r * 0.18 - t * 0.8) + Math.sin((c + r) * 0.08 + t * 0.6);
          const n = (h + 2) / 4; // 0..1
          const alpha = edge * n * 0.75;
          if (alpha < 0.05) continue;
          ctx!.globalAlpha = alpha;
          const accent = n > 0.86 && (c * 31 + r * 17) % 9 === 0;
          ctx!.fillStyle = accent ? ((c + r) % 2 ? colors.flow : colors.gate) : colors.ink;
          ctx!.fillText(n > 0.8 ? '○' : n > 0.62 ? '—' : n > 0.45 ? '·' : '.', x, yBase + h * 4);
        }
      }
    }

    function frame(now: number) {
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      time += dt;
      ctx!.clearRect(0, 0, width, height);
      if (mode === 'sphere') drawSphere();
      else drawWave();
      ctx!.globalAlpha = 1;
      if (!reducedMotion && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function onPointer(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)));
      pointer.y = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
    }

    function onVisibility() {
      if (!document.hidden && visible && !reducedMotion) start();
    }

    resize();
    time = mode === 'sphere' ? 4000 : 0;
    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMotion || !visible) frame(performance.now());
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else cancelAnimationFrame(raf);
      },
      { rootMargin: '100px' },
    );
    io.observe(canvas);

    // Fonts may land after first paint; redraw once they do.
    document.fonts?.ready.then(() => {
      if (reducedMotion || !visible) frame(performance.now());
    });

    if (!reducedMotion && mode === 'sphere') window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, reducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
