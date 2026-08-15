import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { computeLayeredLayout } from '../lib/flowLayout';
import { projects } from '../data/projects';
import { useReducedMotion } from '../hooks/useReducedMotion';

const FEATURED = projects.find((p) => p.id === 'datasleuth') ?? projects[0];
const OPTS = { nodeW: 14, nodeH: 14, layerGap: 56, siblingGap: 40, laneGap: 32, pad: 20 };

/**
 * Ambient graph portrait for the hero's empty right side — the real
 * DataSleuth pipeline shape, laid out with the same engine that drives
 * the workflow modals, just axis-swapped into a vertical spine
 * (renderX = layout.y, renderY = layout.x) and dimmed to sit behind the
 * text. Reinforces the same graph metaphor rather than adding new
 * decoration.
 */
export default function HeroGraph() {
  const reducedMotion = useReducedMotion();
  const layout = useMemo(() => computeLayeredLayout(FEATURED.nodes, FEATURED.edges, OPTS), []);

  const width = layout.height;
  const height = layout.width;
  const spine = layout.layers.map((ids) => ids[0]).filter(Boolean) as string[];
  const packetPoints = spine
    .map((id) => layout.positions.get(id))
    .filter(Boolean)
    .map((p) => ({ x: p!.y, y: p!.x }));

  return (
    <div
      className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none select-none"
      style={{ width: Math.min(width, 300) }}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={Math.min(height, 640)} preserveAspectRatio="xMidYMid meet">
        {layout.edgeRoutes.map((route, i) => {
          const from = layout.positions.get(route.edge.from);
          const to = layout.positions.get(route.edge.to);
          if (!from || !to) return null;
          const isFault = route.edge.kind === 'retry' || route.edge.kind === 'reject';
          const x1 = from.y;
          const y1 = from.x;
          const x2 = to.y;
          const y2 = to.x;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={isFault ? 'var(--fault)' : 'var(--line)'}
              strokeWidth={1}
              opacity={isFault ? 0.4 : 0.35}
            />
          );
        })}

        {FEATURED.nodes.map((node) => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          const x = pos.y;
          const y = pos.x;
          const isGate = node.kind === 'gate';
          const isTerminal = node.kind === 'terminal';
          const isDeterministic = node.kind === 'deterministic';
          const size = isTerminal ? 6 : 9;
          return isTerminal ? (
            <circle key={node.id} cx={x} cy={y} r={size / 2} fill="var(--panel)" stroke="var(--line)" strokeWidth={1} opacity={0.7} />
          ) : (
            <rect
              key={node.id}
              x={x - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rx={1.5}
              fill="var(--panel)"
              stroke={isGate ? 'var(--gate)' : 'var(--line)'}
              strokeWidth={1}
              strokeDasharray={isDeterministic ? '2 2' : undefined}
              opacity={0.85}
            />
          );
        })}

        {!reducedMotion && packetPoints.length > 1 && (
          <motion.circle
            r={2.5}
            fill="var(--flow)"
            initial={{ cx: packetPoints[0].x, cy: packetPoints[0].y, opacity: 0 }}
            animate={{
              cx: packetPoints.map((p) => p.x),
              cy: packetPoints.map((p) => p.y),
              opacity: [0, 1, 1, 1, 0],
            }}
            transition={{
              duration: 0.6 * packetPoints.length,
              repeat: Infinity,
              repeatDelay: 2,
              ease: 'linear',
            }}
          />
        )}
      </svg>
    </div>
  );
}
