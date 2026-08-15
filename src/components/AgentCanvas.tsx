import { useEffect, useRef, useState } from 'react';
import type { EdgeKind, Project } from '../types';
import { computeLayers } from '../lib/flowLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AgentCanvasProps {
  activeProject: Project | null;
}

const NODE_COUNT = 28;
const REPEL_RADIUS = 140;
const NODE_SIZE = 5;
const LINE_COLOR = '#1e2a42';
const FLOW_COLOR = '#38e0d4';
const FAULT_COLOR = '#ff5d73';

interface CanvasNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  opacityTarget: number;
  formX: number;
  formY: number;
  pulseUntil: number;
  seed: number;
}

interface CanvasEdge {
  a: number;
  b: number;
  curve: number;
  key: string;
  kind: EdgeKind;
  isFormation: boolean;
}

interface Packet {
  edgeIndex: number;
  t: number;
  speed: number;
  reverse: boolean;
  color: string;
}

export default function AgentCanvas({ activeProject }: AgentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion();

  const stateRef = useRef<{
    nodes: CanvasNode[];
    ambientEdges: CanvasEdge[];
    formationEdges: CanvasEdge[];
    packets: Packet[];
    mouse: { x: number; y: number; active: boolean };
    mode: 'ambient' | 'formed';
    width: number;
    height: number;
    dpr: number;
    lastTime: number;
    nextPacketAt: number;
    redraw: (() => void) | null;
  }>({
    nodes: [],
    ambientEdges: [],
    formationEdges: [],
    packets: [],
    mouse: { x: 0, y: 0, active: false },
    mode: 'ambient',
    width: 0,
    height: 0,
    dpr: 1,
    lastTime: 0,
    nextPacketAt: 0,
    redraw: null,
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const state = stateRef.current;

    function seedNodes(width: number, height: number) {
      state.nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        opacity: 1,
        opacityTarget: 1,
        formX: 0,
        formY: 0,
        pulseUntil: 0,
        seed: Math.random() * 1000,
      }));

      const edges: CanvasEdge[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < state.nodes.length; i++) {
        const distances = state.nodes
          .map((n, j) => ({ j, d: Math.hypot(n.x - state.nodes[i].x, n.y - state.nodes[i].y) }))
          .filter((e) => e.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        for (const { j } of distances) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push({ a: i, b: j, curve: (Math.random() - 0.5) * 60, key, kind: 'flow', isFormation: false });
        }
      }
      state.ambientEdges = edges;
    }

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = width;
      state.height = height;
      state.dpr = dpr;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.nodes.length === 0) seedNodes(width, height);
    }

    resize();

    let resizeTimer: number | undefined;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    }
    window.addEventListener('resize', onResize);

    function onMouseMove(e: MouseEvent) {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
      state.mouse.active = true;
    }
    function onMouseLeave() {
      state.mouse.active = false;
    }
    if (!isTouch && !reducedMotion) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseleave', onMouseLeave);
    }

    function drawStatic() {
      const activeEdges = state.mode === 'formed' ? state.formationEdges : state.ambientEdges;
      const dim = state.mode === 'formed' ? 0.25 : 1;
      ctx!.clearRect(0, 0, state.width, state.height);
      for (const edge of activeEdges) {
        const a = state.nodes[edge.a];
        const b = state.nodes[edge.b];
        if (!a || !b) continue;
        drawEdge(ctx!, a, b, edge, LINE_COLOR, dim, false);
      }
      for (const node of state.nodes) {
        drawNode(ctx!, node, 0, dim);
      }
    }

    if (reducedMotion) {
      state.redraw = drawStatic;
      drawStatic();
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }

    function maybeSpawnPacket(now: number) {
      if (state.mode !== 'ambient') return;
      if (now < state.nextPacketAt) return;
      const pool = state.ambientEdges;
      if (pool.length === 0) return;
      const edgeIndex = Math.floor(Math.random() * pool.length);
      state.packets.push({ edgeIndex, t: 0, speed: 0.9 + Math.random() * 0.4, reverse: false, color: FLOW_COLOR });
      state.nextPacketAt = now + 2200 + Math.random() * 1800;
    }

    function step(now: number) {
      const dt = Math.min((now - state.lastTime) / 1000, 0.05) || 0.016;
      state.lastTime = now;

      const activeEdges = state.mode === 'formed' ? state.formationEdges : state.ambientEdges;

      // update nodes
      for (const node of state.nodes) {
        node.opacity += (node.opacityTarget - node.opacity) * Math.min(dt * 4, 1);

        if (state.mode === 'formed' && node.opacityTarget > 0) {
          node.x += (node.formX - node.x) * Math.min(dt * 3.5, 1);
          node.y += (node.formY - node.y) * Math.min(dt * 3.5, 1);
          continue;
        }

        // ambient drift
        node.vx += Math.sin(now * 0.0002 + node.seed) * 0.6 * dt;
        node.vy += Math.cos(now * 0.00025 + node.seed) * 0.6 * dt;

        if (state.mouse.active) {
          const dx = node.x - state.mouse.x;
          const dy = node.y - state.mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < REPEL_RADIUS && dist > 0.01) {
            const force = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * 40;
            node.vx += (dx / dist) * force * dt;
            node.vy += (dy / dist) * force * dt;
          }
        }

        const speed = Math.hypot(node.vx, node.vy);
        const maxSpeed = 14;
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }

        node.x += node.vx * dt;
        node.y += node.vy * dt;

        if (node.x < 0 || node.x > state.width) node.vx *= -1;
        if (node.y < 0 || node.y > state.height) node.vy *= -1;
        node.x = Math.max(0, Math.min(state.width, node.x));
        node.y = Math.max(0, Math.min(state.height, node.y));
      }

      maybeSpawnPacket(now);

      // update packets
      state.packets = state.packets.filter((p) => {
        p.t += dt * p.speed;
        if (p.t >= 1) {
          const edge = activeEdges[p.edgeIndex];
          if (edge) {
            const targetNode = state.nodes[p.reverse ? edge.a : edge.b];
            if (targetNode) targetNode.pulseUntil = now + 420;
            if (!p.reverse && Math.random() < 0.22) {
              state.packets.push({
                edgeIndex: p.edgeIndex,
                t: 0,
                speed: p.speed * 0.9,
                reverse: true,
                color: FAULT_COLOR,
              });
            }
          }
          return false;
        }
        return true;
      });

      render(now, activeEdges);
      rafId = requestAnimationFrame(step);
    }

    function render(now: number, activeEdges: CanvasEdge[]) {
      ctx!.clearRect(0, 0, state.width, state.height);

      const dim = state.mode === 'formed' ? 0.25 : 1;

      for (const edge of activeEdges) {
        const a = state.nodes[edge.a];
        const b = state.nodes[edge.b];
        if (!a || !b) continue;
        const hasPacket = state.packets.some(
          (p) => activeEdges[p.edgeIndex] === edge,
        );
        drawEdge(ctx!, a, b, edge, hasPacket ? FLOW_COLOR : LINE_COLOR, dim, hasPacket);
      }

      for (const p of state.packets) {
        const edge = activeEdges[p.edgeIndex];
        if (!edge) continue;
        const a = state.nodes[edge.a];
        const b = state.nodes[edge.b];
        if (!a || !b) continue;
        const from = p.reverse ? b : a;
        const to = p.reverse ? a : b;
        const pt = pointOnCurve(from, to, edge.curve, p.t);
        ctx!.save();
        ctx!.globalAlpha = dim;
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 8;
        ctx!.beginPath();
        ctx!.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      for (const node of state.nodes) {
        drawNode(ctx!, node, now, dim);
      }
    }

    let rafId = requestAnimationFrame(step);

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        state.lastTime = performance.now();
        rafId = requestAnimationFrame(step);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(resizeTimer);
    };
  }, [ready, reducedMotion]);

  // form / scatter into the active project's pipeline shape
  useEffect(() => {
    const state = stateRef.current;
    if (!ready || state.nodes.length === 0) return;

    if (!activeProject) {
      state.mode = 'ambient';
      state.formationEdges = [];
      for (const node of state.nodes) {
        node.opacityTarget = 1;
        if (reducedMotion) {
          node.opacity = 1;
          node.x = Math.random() * state.width;
          node.y = Math.random() * state.height;
        } else {
          node.vx = (Math.random() - 0.5) * 30;
          node.vy = (Math.random() - 0.5) * 30;
        }
      }
      state.redraw?.();
      return;
    }

    const { layers } = computeLayers(activeProject.nodes, activeProject.edges);
    const orderedIds = layers.flat();
    const vertical = state.width < 768;
    const count = orderedIds.length;
    const spanX = vertical ? 0 : Math.min(state.width * 0.6, count * 130);
    const spanY = vertical ? Math.min(state.height * 0.6, count * 90) : 0;
    const startX = state.width / 2 - spanX / 2;
    const startY = state.height / 2 - spanY / 2;

    const indexById = new Map<string, number>();

    for (let i = 0; i < state.nodes.length; i++) {
      const node = state.nodes[i];
      if (i < count) {
        indexById.set(orderedIds[i], i);
        node.formX = vertical ? state.width / 2 : startX + (count > 1 ? (i / (count - 1)) * spanX : spanX / 2);
        node.formY = vertical ? startY + (count > 1 ? (i / (count - 1)) * spanY : spanY / 2) : state.height / 2;
        node.opacityTarget = 1;
        if (reducedMotion) {
          node.x = node.formX;
          node.y = node.formY;
          node.opacity = 1;
        }
      } else {
        node.opacityTarget = 0;
        if (reducedMotion) node.opacity = 0;
      }
    }

    const formationEdges: CanvasEdge[] = activeProject.edges.map((edge) => ({
      a: indexById.get(edge.from) ?? 0,
      b: indexById.get(edge.to) ?? 0,
      curve: edge.kind === 'retry' ? 50 : 0,
      key: `${edge.from}-${edge.to}`,
      kind: edge.kind,
      isFormation: true,
    }));

    state.formationEdges = formationEdges;
    state.mode = 'formed';
    state.packets = [];
    state.redraw?.();
  }, [activeProject, ready, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

function pointOnCurve(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curve: number,
  t: number,
) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;

  const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
  const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
  return { x, y };
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  a: CanvasNode,
  b: CanvasNode,
  edge: CanvasEdge,
  color: string,
  dim: number,
  active: boolean,
) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * edge.curve;
  const cy = my + ny * edge.curve;

  ctx.save();
  ctx.globalAlpha = Math.min(a.opacity, b.opacity) * dim * (edge.kind === 'retry' ? 0.8 : 0.5);
  ctx.strokeStyle = edge.kind === 'retry' && active ? FAULT_COLOR : color;
  ctx.lineWidth = active ? 1.4 : 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, node: CanvasNode, now: number, dim = 1) {
  if (node.opacity <= 0.01) return;
  const pulsing = node.pulseUntil > now;
  const pulseProgress = pulsing ? 1 - (node.pulseUntil - now) / 420 : 0;
  const size = NODE_SIZE + (pulsing ? (1 - pulseProgress) * 6 : 0);

  ctx.save();
  ctx.globalAlpha = node.opacity * dim;
  if (pulsing) {
    ctx.shadowColor = FLOW_COLOR;
    ctx.shadowBlur = 10 * (1 - pulseProgress);
  }
  ctx.fillStyle = pulsing ? FLOW_COLOR : '#0f1524';
  ctx.strokeStyle = pulsing ? FLOW_COLOR : LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(node.x - size / 2, node.y - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
