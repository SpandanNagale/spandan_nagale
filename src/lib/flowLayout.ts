import type { FlowEdge, FlowNode } from '../types';

/**
 * Sugiyama-style layered DAG layout, written from scratch (no graph library).
 *
 * 1. classifyBackEdges: a single DFS over the raw graph (any edge kind)
 *    classifies each edge as tree/cross ("forward") or back, purely by
 *    traversal structure — an edge that lands on a node still on the DFS
 *    stack is a back edge. This is what correctly identifies loop-back
 *    edges even when the *semantic* retry edge points forward into a
 *    repair node and the plain "continue" edge is the one that actually
 *    closes the cycle (see analytics_executor <-> self_corrector).
 * 2. computeLayers: longest-path layering via Kahn's algorithm over the
 *    forward-only edge set, then a barycenter pass to order siblings
 *    within each layer using their forward predecessors' positions.
 * 3. computeLayeredLayout: turns layers/order into pixel positions and
 *    classifies every edge as a direct adjacent-layer connector or an
 *    arc (back edge, or a forward edge that skips over intermediate
 *    layers), assigning arcs to non-overlapping lanes via interval
 *    coloring so multiple loop-backs don't stack on top of each other.
 */

export function classifyBackEdges(nodes: FlowNode[], edges: FlowEdge[]): Set<FlowEdge> {
  const adjacency = new Map<string, FlowEdge[]>(nodes.map((n) => [n.id, []]));
  for (const edge of edges) {
    if (adjacency.has(edge.from)) adjacency.get(edge.from)!.push(edge);
  }

  const state = new Map<string, 0 | 1 | 2>(nodes.map((n) => [n.id, 0]));
  const backEdges = new Set<FlowEdge>();

  function dfs(id: string) {
    state.set(id, 1);
    for (const edge of adjacency.get(id) ?? []) {
      const targetState = state.get(edge.to);
      if (targetState === undefined) continue;
      if (targetState === 0) dfs(edge.to);
      else if (targetState === 1) backEdges.add(edge);
    }
    state.set(id, 2);
  }

  const hasIncoming = new Set(edges.map((e) => e.to));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));
  const startIds = roots.length ? roots.map((r) => r.id) : nodes.slice(0, 1).map((n) => n.id);
  for (const id of startIds) if (state.get(id) === 0) dfs(id);
  for (const n of nodes) if (state.get(n.id) === 0) dfs(n.id);

  return backEdges;
}

export interface LayerInfo {
  layerOf: Map<string, number>;
  orderOf: Map<string, number>;
  layers: string[][];
  backEdges: Set<FlowEdge>;
}

export function computeLayers(nodes: FlowNode[], edges: FlowEdge[]): LayerInfo {
  const backEdges = classifyBackEdges(nodes, edges);
  const forward = edges.filter((e) => !backEdges.has(e));

  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of forward) {
    if (!adjacency.has(edge.from) || !indegree.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const layerOf = new Map<string, number>();
  const remaining = new Map(indegree);
  const queue: string[] = nodes.filter((n) => remaining.get(n.id) === 0).map((n) => n.id);
  queue.forEach((id) => layerOf.set(id, 0));

  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    const layer = layerOf.get(id) ?? 0;
    for (const next of adjacency.get(id) ?? []) {
      layerOf.set(next, Math.max(layerOf.get(next) ?? 0, layer + 1));
      remaining.set(next, (remaining.get(next) ?? 0) - 1);
      if (remaining.get(next) === 0) queue.push(next);
    }
  }
  for (const n of nodes) if (!layerOf.has(n.id)) layerOf.set(n.id, 0);

  const layerCount = Math.max(0, ...[...layerOf.values()]) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) layers[layerOf.get(n.id)!].push(n.id);

  const predecessors = new Map<string, string[]>();
  for (const edge of forward) {
    if (!predecessors.has(edge.to)) predecessors.set(edge.to, []);
    predecessors.get(edge.to)!.push(edge.from);
  }

  const orderOf = new Map<string, number>();
  layers[0]?.forEach((id, i) => orderOf.set(id, i));

  for (let l = 1; l < layerCount; l++) {
    const originalIndex = new Map(layers[l].map((id, i) => [id, i]));
    const scored = layers[l].map((id) => {
      const preds = predecessors.get(id) ?? [];
      const score = preds.length
        ? preds.reduce((sum, p) => sum + (orderOf.get(p) ?? 0), 0) / preds.length
        : Number.MAX_SAFE_INTEGER;
      return { id, score };
    });
    scored.sort((a, b) => a.score - b.score || originalIndex.get(a.id)! - originalIndex.get(b.id)!);
    layers[l] = scored.map((s) => s.id);
    layers[l].forEach((id, i) => orderOf.set(id, i));
  }

  return { layerOf, orderOf, layers, backEdges };
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  layer: number;
  indexInLayer: number;
}

export interface EdgeRoute {
  edge: FlowEdge;
  isBack: boolean;
  lane: number | null; // null = direct connector between adjacent layers
}

export interface LayeredLayout {
  positions: Map<string, NodePosition>;
  layers: string[][];
  edgeRoutes: EdgeRoute[];
  layerCount: number;
  maxLayerSize: number;
  laneCount: number;
  width: number;
  height: number;
  bodyHeight: number;
}

export interface LayoutOptions {
  nodeW: number;
  nodeH: number;
  layerGap: number;
  siblingGap: number;
  laneGap: number;
  pad: number;
}

export function computeLayeredLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  opts: LayoutOptions,
): LayeredLayout {
  const { layerOf, layers, backEdges } = computeLayers(nodes, edges);
  const { nodeW, nodeH, layerGap, siblingGap, laneGap, pad } = opts;

  const maxLayerSize = Math.max(1, ...layers.map((l) => l.length));
  const bodyHeight = maxLayerSize * nodeH + (maxLayerSize - 1) * siblingGap;

  const positions = new Map<string, NodePosition>();
  layers.forEach((layerIds, layerIndex) => {
    const layerHeight = layerIds.length * nodeH + (layerIds.length - 1) * siblingGap;
    const startY = pad + (bodyHeight - layerHeight) / 2;
    layerIds.forEach((id, i) => {
      positions.set(id, {
        id,
        x: pad + layerIndex * (nodeW + layerGap) + nodeW / 2,
        y: startY + i * (nodeH + siblingGap) + nodeH / 2,
        layer: layerIndex,
        indexInLayer: i,
      });
    });
  });

  // Edges needing arc routing: back edges, or forward edges skipping layers.
  const arcCandidates: { edge: FlowEdge; span: [number, number] }[] = [];
  const directEdges: FlowEdge[] = [];

  for (const edge of edges) {
    const from = layerOf.get(edge.from) ?? 0;
    const to = layerOf.get(edge.to) ?? 0;
    const isBack = backEdges.has(edge);
    if (isBack || Math.abs(to - from) > 1) {
      arcCandidates.push({ edge, span: [Math.min(from, to), Math.max(from, to)] });
    } else {
      directEdges.push(edge);
    }
  }

  // Greedy interval coloring: assign each arc the lowest lane whose
  // occupied span doesn't overlap this edge's layer span.
  arcCandidates.sort((a, b) => a.span[1] - a.span[0] - (b.span[1] - b.span[0]));
  const laneSpans: [number, number][] = [];
  const edgeRoutes: EdgeRoute[] = [];

  for (const { edge, span } of arcCandidates) {
    let lane = laneSpans.findIndex(([s, e]) => span[0] > e || span[1] < s);
    if (lane === -1) {
      lane = laneSpans.length;
      laneSpans.push(span);
    } else {
      const [s, e] = laneSpans[lane];
      laneSpans[lane] = [Math.min(s, span[0]), Math.max(e, span[1])];
    }
    edgeRoutes.push({ edge, isBack: backEdges.has(edge), lane });
  }
  for (const edge of directEdges) {
    edgeRoutes.push({ edge, isBack: false, lane: null });
  }

  const laneCount = laneSpans.length;
  const width = pad * 2 + layers.length * nodeW + Math.max(0, layers.length - 1) * layerGap;
  const height = pad * 2 + bodyHeight + laneCount * laneGap + (laneCount > 0 ? pad : 0);

  return {
    positions,
    layers,
    edgeRoutes,
    layerCount: layers.length,
    maxLayerSize,
    laneCount,
    width,
    height,
    bodyHeight,
  };
}
