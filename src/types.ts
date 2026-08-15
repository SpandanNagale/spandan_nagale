export type NodeKind = 'agent' | 'gate' | 'deterministic' | 'terminal';

export interface FlowNode {
  id: string;
  label: string; // mono, shown in the box
  job: string; // one line, muted, under the label
  kind: NodeKind; // 'gate' amber border, 'deterministic' dashed border, 'terminal' small pill
  model?: string; // e.g. 'qwen3:14b' — rendered as a small mono tag bottom-right
}

export type EdgeKind = 'flow' | 'retry' | 'reject' | 'branch';

export interface FlowEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string; // the condition, e.g. 'invalid, retries left'
}

export interface Metric {
  value: string;
  label: string;
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  repo: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  howItWorks: string;
  highlights: string[];
  metrics: Metric[];
  stack: string[];
  evalMethodologyUrl?: string; // shown as a muted mono link under the metrics row
}
