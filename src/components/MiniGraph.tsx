import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { FlowEdge, FlowNode } from '../types';
import { computeLayers } from '../lib/flowLayout';

interface MiniGraphProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  active: boolean;
  reducedMotion: boolean;
}

const WIDTH = 200;
const HEIGHT = 36;
const DOT = 5;

export default function MiniGraph({ nodes, edges, active, reducedMotion }: MiniGraphProps) {
  const { layerOf, layers } = computeLayers(nodes, edges);
  const layerCount = layers.length;

  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((layerIds, layerIndex) => {
    const x = layerCount > 1 ? 10 + (layerIndex / (layerCount - 1)) * (WIDTH - 20) : WIDTH / 2;
    const count = layerIds.length;
    layerIds.forEach((id, i) => {
      const y = HEIGHT / 2 + (i - (count - 1) / 2) * Math.min(10, (HEIGHT - 8) / Math.max(count, 1));
      positions.set(id, { x, y });
    });
  });

  const spine = layers.map((layerIds) => layerIds[0]).filter(Boolean) as string[];
  const spinePoints = spine.map((id) => positions.get(id)!);

  const [runId, setRunId] = useState(0);
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) setRunId((id) => id + 1);
    wasActive.current = active;
  }, [active]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-9" aria-hidden="true" focusable="false">
      {edges.map((edge, i) => {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) return null;
        const isBack = (layerOf.get(edge.to) ?? 0) <= (layerOf.get(edge.from) ?? 0);
        return (
          <line
            key={`e-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray={edge.kind === 'reject' ? '3 2' : isBack ? '2 2' : undefined}
            opacity={isBack ? 0.4 : 0.7}
          />
        );
      })}
      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const isTerminal = node.kind === 'terminal';
        const isGate = node.kind === 'gate';
        const isDeterministic = node.kind === 'deterministic';
        const size = isTerminal ? DOT - 1.5 : DOT;
        return isTerminal ? (
          <circle
            key={node.id}
            cx={pos.x}
            cy={pos.y}
            r={size / 2}
            fill="var(--panel)"
            stroke="var(--line)"
            strokeWidth={1}
          />
        ) : (
          <rect
            key={node.id}
            x={pos.x - size / 2}
            y={pos.y - size / 2}
            width={size}
            height={size}
            rx={1}
            fill="var(--panel)"
            stroke={isGate ? 'var(--gate)' : 'var(--line)'}
            strokeWidth={1}
            strokeDasharray={isDeterministic ? '2 1.5' : undefined}
          />
        );
      })}
      {!reducedMotion && spinePoints.length > 1 && (
        <motion.circle
          key={runId}
          r={2.5}
          fill="var(--flow)"
          initial={{ cx: spinePoints[0].x, cy: spinePoints[0].y, opacity: 0 }}
          animate={
            active
              ? {
                  cx: spinePoints.map((p) => p.x),
                  cy: spinePoints.map((p) => p.y),
                  opacity: [0, 1, 1, 0],
                }
              : { opacity: 0 }
          }
          transition={{ duration: 1.1, ease: 'linear' }}
        />
      )}
    </svg>
  );
}
