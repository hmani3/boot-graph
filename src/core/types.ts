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

export type ReadinessProbe =
  | {
      type: "tcp";
      host: string;
      port: number;
      timeoutMs?: number;
      retryIntervalMs?: number;
      maxRetries?: number;
    }
  | {
      type: "command";
      command: string;
      timeoutMs?: number;
      retryIntervalMs?: number;
      maxRetries?: number;
    }
  | {
      type: "file";
      path: string;
      timeoutMs?: number;
      retryIntervalMs?: number;
      maxRetries?: number;
    }
  | {
      type: "http";
      url: string;
      expectedStatus?: number;
      timeoutMs?: number;
      retryIntervalMs?: number;
      maxRetries?: number;
    };

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

  // Project context & Dev Docs
  sourceFile?: string;
  sourceSnippet?: string;
  sourceLineRange?: [number, number];
  docLinks: DocLink[];

  // Graph wiring contracts
  provides: string[];
  requires: string[];

  // Readiness validation
  probe?: ReadinessProbe;

  // Interactive Env editing
  envKeys?: EnvVariableEntry[];

  // Execution state
  output?: string;
  durationMs?: number;
  exitCode?: number;
  autoRun?: boolean;

  // Visual layout coordinates for React Flow
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

export interface BootGraphConfigFile {
  $schema?: string;
  name?: string;
  overrides?: Record<
    string,
    {
      command?: string;
      tier?: LifecycleTier;
      enabled?: boolean;
      requires?: string[];
      provides?: string[];
    }
  >;
  customNodes?: Array<{
    id: string;
    name: string;
    tier: LifecycleTier;
    category?: NodeCategory;
    command: string;
    description?: string;
    requires?: string[];
    provides?: string[];
  }>;
}

// WebSocket Protocols
export type ClientMessage =
  | { type: "RUN_NODE"; nodeId: string; commandOverride?: string }
  | { type: "SKIP_NODE"; nodeId: string }
  | { type: "RUN_ALL" }
  | { type: "STOP_NODE"; nodeId: string }
  | { type: "TERMINAL_INPUT"; nodeId: string; data: string }
  | { type: "UPDATE_NODE"; nodeId: string; updates: Partial<SetupNode> }
  | { type: "ADD_NODE"; node: SetupNode }
  | { type: "DELETE_NODE"; nodeId: string }
  | { type: "CONNECT_NODES"; source: string; target: string }
  | { type: "DISCONNECT_NODES"; edgeId: string }
  | { type: "SAVE_ENV"; entries: Record<string, string> }
  | { type: "SAVE_CONFIG" }
  | { type: "RESET_LAYOUT" }
  | { type: "RESCAN" };

export type ServerMessage =
  | { type: "GRAPH_INIT"; manifest: BootGraphManifest; config?: BootGraphConfigFile }
  | {
      type: "NODE_STATUS_CHANGE";
      nodeId: string;
      status: NodeStatus;
      durationMs?: number;
      exitCode?: number;
    }
  | { type: "TERMINAL_OUTPUT"; nodeId: string; chunk: string }
  | {
      type: "PROBE_STATUS";
      nodeId: string;
      probing: boolean;
      success?: boolean;
      message?: string;
    }
  | { type: "GRAPH_UPDATED"; manifest: BootGraphManifest }
  | { type: "ENV_SAVED"; success: boolean; message?: string }
  | { type: "ERROR"; message: string; code?: string };
