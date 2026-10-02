export type LifecycleTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const LIFECYCLE_TIER_NAMES: Record<LifecycleTier, string> = {
  1: "System Runtimes",
  2: "Package Dependencies",
  3: "Environment Configuration",
  4: "Infrastructure Services",
  5: "Schema & Migrations",
  6: "Data Seeding",
  7: "Application Launch",
};

export interface TierTheme {
  name: string;
  stageLabel: string;
  badge: string;
  border: string;
  accentBar: string;
  dotColor: string;
  glow: string;
}

export const TIER_THEMES: Record<LifecycleTier, TierTheme> = {
  1: {
    name: "System Runtimes",
    stageLabel: "STAGE 1",
    badge: "bg-sky-950/80 text-sky-300 border-sky-800/80",
    border: "border-sky-500/70 shadow-sky-950/40",
    accentBar: "bg-sky-500",
    dotColor: "#0ea5e9",
    glow: "rgba(14, 165, 233, 0.15)",
  },
  2: {
    name: "Package Dependencies",
    stageLabel: "STAGE 2",
    badge: "bg-indigo-950/80 text-indigo-300 border-indigo-800/80",
    border: "border-indigo-500/70 shadow-indigo-950/40",
    accentBar: "bg-indigo-500",
    dotColor: "#6366f1",
    glow: "rgba(99, 102, 241, 0.15)",
  },
  3: {
    name: "Environment Setup",
    stageLabel: "STAGE 3",
    badge: "bg-amber-950/80 text-amber-300 border-amber-800/80",
    border: "border-amber-500/70 shadow-amber-950/40",
    accentBar: "bg-amber-500",
    dotColor: "#eab308",
    glow: "rgba(234, 179, 8, 0.15)",
  },
  4: {
    name: "Infrastructure Services",
    stageLabel: "STAGE 4",
    badge: "bg-purple-950/80 text-purple-300 border-purple-800/80",
    border: "border-purple-500/70 shadow-purple-950/40",
    accentBar: "bg-purple-500",
    dotColor: "#a855f7",
    glow: "rgba(168, 85, 247, 0.15)",
  },
  5: {
    name: "Schema & Migrations",
    stageLabel: "STAGE 5",
    badge: "bg-teal-950/80 text-teal-300 border-teal-800/80",
    border: "border-teal-500/70 shadow-teal-950/40",
    accentBar: "bg-teal-500",
    dotColor: "#14b8a6",
    glow: "rgba(20, 184, 166, 0.15)",
  },
  6: {
    name: "Data Seeding",
    stageLabel: "STAGE 6",
    badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
    border: "border-emerald-500/70 shadow-emerald-950/40",
    accentBar: "bg-emerald-500",
    dotColor: "#10b981",
    glow: "rgba(16, 185, 129, 0.15)",
  },
  7: {
    name: "Application Launch",
    stageLabel: "STAGE 7",
    badge: "bg-rose-950/80 text-rose-300 border-rose-800/80",
    border: "border-rose-500/70 shadow-rose-950/40",
    accentBar: "bg-rose-500",
    dotColor: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.15)",
  },
};

export type NodeCategory =
  | "runtime"
  | "package"
  | "env"
  | "service"
  | "db"
  | "seed"
  | "app"
  | "custom";

export type NodeStatus =
  | "blocked"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface DocLink {
  title: string;
  url: string;
  type: "local" | "external" | "official";
  description?: string;
}

export interface EnvVariableEntry {
  key: string;
  required: boolean;
  defaultValue?: string;
  currentValue?: string;
  description?: string;
}

export interface ReadinessProbe {
  type: "tcp" | "command" | "file" | "http";
  host?: string;
  port?: number;
  command?: string;
  path?: string;
  url?: string;
}

export interface SetupNode {
  id: string;
  name: string;
  tier: LifecycleTier;
  category: NodeCategory;
  status: NodeStatus;
  command: string;
  cwd?: string;
  description: string;
  rationale?: string;

  sourceFile?: string;
  sourceSnippet?: string;
  sourceLineRange?: [number, number];
  docLinks: DocLink[];

  provides: string[];
  requires: string[];

  probe?: ReadinessProbe;
  envKeys?: EnvVariableEntry[];

  output?: string;
  durationMs?: number;
  exitCode?: number;
  autoRun?: boolean;

  position?: { x: number; y: number };
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface BootGraphManifest {
  name: string;
  rootPath: string;
  nodes: SetupNode[];
  edges: DAGEdge[];
  createdAt: string;
  summary: {
    totalNodes: number;
    tiersPresent: LifecycleTier[];
    envKeysMissing: number;
    detectedStacks: string[];
  };
}
