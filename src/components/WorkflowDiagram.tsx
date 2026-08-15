import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, FlowEdge } from '../types';
import { computeLayeredLayout, type LayeredLayout, type NodePosition } from '../lib/flowLayout';

interface WorkflowDiagramProps {
  project: Project;
  play: boolean;
  reducedMotion: boolean;
}

const NODE_W = 152;
const NODE_H = 60;
const TERMINAL_W = 108;
const TERMINAL_H = 30;
const LAYOUT_OPTS = { nodeW: NODE_W, nodeH: NODE_H, layerGap: 68, siblingGap: 26, laneGap: 34, pad: 26 };

const FLOW_COLOR = 'var(--flow)';
const LINE_COLOR = 'var(--line)';
const GATE_COLOR = 'var(--gate)';
const FAULT_COLOR = 'var(--fault)';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Follows the primary forward path (flow, then branch, then reject) from
 * the entry node to a terminal, for the single demo packet to travel. */
function findPrimaryPath(project: Project): string[] {
  const byFrom = new Map<string, FlowEdge[]>();
  for (const e of project.edges) {
    if (!byFrom.has(e.from)) byFrom.set(e.from, []);
    byFrom.get(e.from)!.push(e);
  }
  const hasIncoming = new Set(project.edges.map((e) => e.to));
  const start = project.nodes.find((n) => !hasIncoming.has(n.id))?.id ?? project.nodes[0]?.id;
  if (!start) return [];

  const priority = { flow: 0, branch: 1, reject: 2, retry: 3 };
  const visited = new Set<string>();
  const path = [start];
  let current = start;
  visited.add(current);

  for (let step = 0; step < project.nodes.length + 2; step++) {
    const options = (byFrom.get(current) ?? [])
      .filter((e) => !visited.has(e.to))
      .sort((a, b) => priority[a.kind] - priority[b.kind]);
    const next = options[0];
    if (!next) break;
    path.push(next.to);
    visited.add(next.to);
    current = next.to;
  }
  return path;
}

export default function WorkflowDiagram({ project, play, reducedMotion }: WorkflowDiagramProps) {
  const layout = useMemo(() => computeLayeredLayout(project.nodes, project.edges, LAYOUT_OPTS), [project]);
  const primaryPath = useMemo(() => findPrimaryPath(project), [project]);

  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (play) setRunId((id) => id + 1);
  }, [play]);

  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExpanded(false);
      }
    }
    // Capture phase: fires before SystemModal's bubble-phase Escape handler,
    // so expanding the diagram doesn't also close the whole modal.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [expanded]);

  const closeExpanded = () => {
    setExpanded(false);
    expandButtonRef.current?.focus();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="mono-label text-muted">WORKFLOW</p>
        <button
          ref={expandButtonRef}
          type="button"
          onClick={() => setExpanded(true)}
          className="mono-label text-muted hover:text-flow border border-line hover:border-flow px-2 py-1"
          style={{ borderRadius: 2 }}
        >
          EXPAND &#x2922;
        </button>
      </div>

      <DiagramViewport
        project={project}
        layout={layout}
        primaryPath={primaryPath}
        play={play}
        reducedMotion={reducedMotion}
        heightPx={340}
        runId={runId}
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-line">
        <LegendItem color={FLOW_COLOR} label="Flow — data moving" />
        <LegendItem color={GATE_COLOR} label="Gate — validation / human-in-the-loop" />
        <LegendItem dashed label="Deterministic — no model involved" />
        <LegendItem color={FAULT_COLOR} label="Retry / reject — rejection loop" />
      </div>

      {expanded &&
        createPortal(
          <ExpandedOverlay
            project={project}
            layout={layout}
            primaryPath={primaryPath}
            reducedMotion={reducedMotion}
            runId={runId}
            onClose={closeExpanded}
          />,
          document.body,
        )}
    </div>
  );
}

function ExpandedOverlay({
  project,
  layout,
  primaryPath,
  reducedMotion,
  runId,
  onClose,
}: {
  project: Project;
  layout: LayeredLayout;
  primaryPath: string[];
  reducedMotion: boolean;
  runId: number;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} workflow, expanded`}
      className="fixed inset-0 z-[100] flex flex-col p-4 md:p-8"
      style={{ background: 'var(--void)' }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-xl text-text">{project.name}</h3>
          <p className="mono-label text-muted">WORKFLOW &mdash; EXPANDED</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close expanded view"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center border border-line text-muted hover:text-flow hover:border-flow transition-colors shrink-0"
          style={{ borderRadius: 2 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <DiagramViewport
          project={project}
          layout={layout}
          primaryPath={primaryPath}
          play={false}
          reducedMotion={reducedMotion}
          heightPx={null}
          runId={runId}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-line shrink-0">
        <LegendItem color={FLOW_COLOR} label="Flow — data moving" />
        <LegendItem color={GATE_COLOR} label="Gate — validation / human-in-the-loop" />
        <LegendItem dashed label="Deterministic — no model involved" />
        <LegendItem color={FAULT_COLOR} label="Retry / reject — rejection loop" />
      </div>
    </div>
  );
}

/** Self-contained pan/zoom SVG viewport. heightPx=null fills the parent
 * flex box instead of using a fixed pixel height (used in the expanded
 * overlay); a number gives it a fixed height (used inline in the modal). */
function DiagramViewport({
  project,
  layout,
  primaryPath,
  play,
  reducedMotion,
  heightPx,
  runId,
}: {
  project: Project;
  layout: LayeredLayout;
  primaryPath: string[];
  play: boolean;
  reducedMotion: boolean;
  heightPx: number | null;
  runId: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    setSize(el.getBoundingClientRect());
    return () => ro.disconnect();
  }, []);

  const fitScale =
    size.width > 0 && size.height > 0
      ? Math.min(1, size.width / layout.width, size.height / layout.height)
      : 1;

  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const resetToFit = () => {
    setTransform({
      scale: fitScale,
      x: (size.width - layout.width * fitScale) / 2,
      y: (size.height - layout.height * fitScale) / 2,
    });
  };

  useEffect(() => {
    if (size.width > 0 && size.height > 0) resetToFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, layout, project.id]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number; mid: { x: number; y: number } } | null>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  function clampScale(s: number) {
    return Math.max(fitScale * 0.6, Math.min(4, s));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: transform.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      dragStart.current = null;
    } else if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const newScale = clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist));
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const midX = pinchStart.current.mid.x - rect.left;
      const midY = pinchStart.current.mid.y - rect.top;
      const contentX = (midX - transform.x) / transform.scale;
      const contentY = (midY - transform.y) / transform.scale;
      setTransform({ scale: newScale, x: midX - contentX * newScale, y: midY - contentY * newScale });
    } else if (pointers.current.size === 1 && dragStart.current) {
      const d = dragStart.current;
      setTransform((t) => ({ ...t, x: d.tx + (e.clientX - d.x), y: d.ty + (e.clientY - d.y) }));
    }
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      dragStart.current = { x: p.x, y: p.y, tx: transform.x, ty: transform.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 0) {
      dragStart.current = null;
      pinchStart.current = null;
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newScale = clampScale(transform.scale * (1 - e.deltaY * 0.0012));
    const contentX = (mx - transform.x) / transform.scale;
    const contentY = (my - transform.y) / transform.scale;
    setTransform({ scale: newScale, x: mx - contentX * newScale, y: my - contentY * newScale });
  }

  const packetPoints = primaryPath.map((id) => layout.positions.get(id)).filter(Boolean) as NodePosition[];
  const needsPanZoom = size.width > 0 && fitScale < 1;

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden border border-line"
      style={{
        borderRadius: 2,
        height: heightPx ?? '100%',
        touchAction: 'none',
        cursor: needsPanZoom ? 'grab' : 'default',
      }}
      onPointerDown={needsPanZoom ? onPointerDown : undefined}
      onPointerMove={needsPanZoom ? onPointerMove : undefined}
      onPointerUp={needsPanZoom ? endPointer : undefined}
      onPointerCancel={needsPanZoom ? endPointer : undefined}
      onWheel={needsPanZoom ? onWheel : undefined}
    >
      {needsPanZoom && (
        <button
          type="button"
          onClick={resetToFit}
          className="absolute top-2 right-2 z-10 mono-label text-muted hover:text-flow border border-line hover:border-flow px-2 py-1 bg-panel"
          style={{ borderRadius: 2 }}
        >
          FIT
        </button>
      )}
      <div
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Workflow diagram for ${project.name}`}
        >
          <defs>
            <marker id={`arrow-${project.id}`} markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={FAULT_COLOR} />
            </marker>
            <marker id={`arrow-line-${project.id}`} markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={LINE_COLOR} />
            </marker>
          </defs>

          {layout.edgeRoutes.map((route, i) => (
            <EdgeShape
              key={`${route.edge.from}-${route.edge.to}-${i}`}
              route={route}
              positions={layout.positions}
              laneGap={LAYOUT_OPTS.laneGap}
              bodyBottom={LAYOUT_OPTS.pad + layout.bodyHeight}
              markerId={route.edge.kind === 'flow' || route.edge.kind === 'branch' ? `arrow-line-${project.id}` : `arrow-${project.id}`}
              active={play && !reducedMotion && isEdgeInPrimaryPath(route.edge, primaryPath)}
            />
          ))}

          {project.nodes.map((node) => {
            const pos = layout.positions.get(node.id);
            if (!pos) return null;
            return <NodeShape key={node.id} node={node} pos={pos} reducedMotion={reducedMotion} />;
          })}

          {!reducedMotion && play && packetPoints.length > 1 && (
            <motion.circle
              key={runId}
              r={4.5}
              fill={FLOW_COLOR}
              initial={{ cx: packetPoints[0].x, cy: packetPoints[0].y, opacity: 0 }}
              animate={{
                cx: packetPoints.map((p) => p.x),
                cy: packetPoints.map((p) => p.y),
                opacity: [0, 1, 1, 1, 0],
              }}
              transition={{
                duration: 0.5 * packetPoints.length,
                delay: 0.05 * project.nodes.length + 0.2,
                ease: 'linear',
              }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function isEdgeInPrimaryPath(edge: FlowEdge, path: string[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] === edge.from && path[i + 1] === edge.to) return true;
  }
  return false;
}

function LegendItem({ color, dashed, label }: { color?: string; dashed?: boolean; label: string }) {
  return (
    <span className="mono-label text-muted flex items-center gap-2">
      {dashed ? (
        <span className="inline-block w-3 h-0" style={{ borderTop: '2px dashed var(--line)' }} />
      ) : (
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

function NodeShape({
  node,
  pos,
  reducedMotion,
}: {
  node: Project['nodes'][number];
  pos: NodePosition;
  reducedMotion: boolean;
}) {
  const isTerminal = node.kind === 'terminal';
  const isGate = node.kind === 'gate';
  const isDeterministic = node.kind === 'deterministic';
  const w = isTerminal ? TERMINAL_W : NODE_W;
  const h = isTerminal ? TERMINAL_H : NODE_H;

  return (
    <motion.g
      initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.045 * pos.layer, ease: 'easeOut' }}
    >
      <rect
        x={pos.x - w / 2}
        y={pos.y - h / 2}
        width={w}
        height={h}
        rx={isTerminal ? h / 2 : 2}
        fill="var(--panel)"
        stroke={isGate ? GATE_COLOR : 'var(--line)'}
        strokeWidth={isGate ? 1.5 : 1}
        strokeDasharray={isDeterministic ? '4 3' : undefined}
      />
      {isTerminal ? (
        <text
          x={pos.x}
          y={pos.y + 3.5}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize={10}
          fontWeight={500}
          fill="var(--text)"
        >
          {node.label}
        </text>
      ) : (
        <>
          <text
            x={pos.x}
            y={pos.y - 8}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={11}
            fontWeight={500}
            fill="var(--text)"
          >
            {node.label}
          </text>
          <text
            x={pos.x}
            y={pos.y + 8}
            textAnchor="middle"
            fontFamily="var(--font-body)"
            fontSize={10}
            fill="var(--muted)"
          >
            {node.job.length > 34 ? `${node.job.slice(0, 32)}…` : node.job}
          </text>
          {node.model && (
            <text
              x={pos.x + w / 2 - 5}
              y={pos.y + h / 2 - 5}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--muted)"
            >
              {node.model}
            </text>
          )}
        </>
      )}
    </motion.g>
  );
}

function EdgeShape({
  route,
  positions,
  laneGap,
  bodyBottom,
  markerId,
  active,
}: {
  route: { edge: FlowEdge; isBack: boolean; lane: number | null };
  positions: Map<string, NodePosition>;
  laneGap: number;
  bodyBottom: number;
  markerId: string;
  active: boolean;
}) {
  const { edge, isBack, lane } = route;
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;

  const isFault = edge.kind === 'retry' || edge.kind === 'reject';
  const color = active ? FLOW_COLOR : isFault ? FAULT_COLOR : LINE_COLOR;
  const dashed = edge.kind === 'reject';
  const showArrow = lane !== null;

  let d: string;
  let labelPos: { x: number; y: number };

  if (lane === null) {
    const forward = to.x >= from.x;
    if (forward) {
      const sx = from.x + NODE_W / 2;
      const tx = to.x - NODE_W / 2;
      d = `M ${sx} ${from.y} C ${(sx + tx) / 2} ${from.y}, ${(sx + tx) / 2} ${to.y}, ${tx} ${to.y}`;
      labelPos = { x: (sx + tx) / 2, y: (from.y + to.y) / 2 - 6 };
    } else {
      const sy = from.y + NODE_H / 2;
      const ty = to.y - NODE_H / 2;
      d = `M ${from.x} ${sy} C ${from.x} ${(sy + ty) / 2}, ${to.x} ${(sy + ty) / 2}, ${to.x} ${ty}`;
      labelPos = { x: (from.x + to.x) / 2, y: (sy + ty) / 2 };
    }
  } else {
    const laneY = bodyBottom + (lane + 1) * laneGap;
    const sx = from.x;
    const sy = from.y + NODE_H / 2;
    const tx = to.x;
    const ty = to.y + NODE_H / 2;
    d = `M ${sx} ${sy} C ${sx} ${laneY}, ${tx} ${laneY}, ${tx} ${ty}`;
    labelPos = { x: (sx + tx) / 2, y: laneY + 3 };
  }

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? 1.8 : 1.3}
        strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        opacity={isBack || dashed ? 0.85 : 0.6}
      />
      {edge.label && (
        <g>
          <rect
            x={labelPos.x - edge.label.length * 2.9}
            y={labelPos.y - 8}
            width={edge.label.length * 5.8}
            height={13}
            fill="var(--void)"
            opacity={0.85}
          />
          <text
            x={labelPos.x}
            y={labelPos.y + 1.5}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={10}
            fill="var(--muted)"
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}
