import {
  SetupNode,
  DAGEdge,
  BootGraphManifest,
  LifecycleTier,
  NodeStatus,
} from "../core/types.js";
import { computeGraphLayout } from "./layout.js";

/**
 * Resolves dependency relationships between nodes using capability contracts and lifecycle tiers
 */
export function buildDAG(
  rawNodes: SetupNode[],
  projectName: string,
  workspaceDir: string
): BootGraphManifest {
  const edges: DAGEdge[] = [];
  const edgeSet = new Set<string>();

  // Map capabilities to provider node IDs
  const capabilityProviders = new Map<string, string[]>();
  const nodeMap = new Map<string, SetupNode>();

  for (const node of rawNodes) {
    nodeMap.set(node.id, node);
    for (const cap of node.provides) {
      const list = capabilityProviders.get(cap) || [];
      list.push(node.id);
      capabilityProviders.set(cap, list);
    }
  }

  for (const target of rawNodes) {
    for (const req of target.requires) {
      if (nodeMap.has(req)) {
        const edgeId = `edge-${req}->${target.id}`;
        if (!edgeSet.has(edgeId) && req !== target.id) {
          edges.push({
            id: edgeId,
            source: req,
            target: target.id,
            animated: true,
          });
          edgeSet.add(edgeId);
        }
      }

      const providers = capabilityProviders.get(req) || [];
      for (const providerId of providers) {
        const edgeId = `edge-${providerId}->${target.id}`;
        if (!edgeSet.has(edgeId) && providerId !== target.id) {
          edges.push({
            id: edgeId,
            source: providerId,
            target: target.id,
            animated: true,
          });
          edgeSet.add(edgeId);
        }
      }
    }
  }

  // Enforce tier progression across the lifecycle pipeline
  const tiersInProject = Array.from(new Set(rawNodes.map((n) => n.tier))).sort(
    (a, b) => a - b
  );

  for (let i = 1; i < tiersInProject.length; i++) {
    const prevTier = tiersInProject[i - 1];
    const currTier = tiersInProject[i];

    const prevNodes = rawNodes.filter((n) => n.tier === prevTier);
    const currNodes = rawNodes.filter((n) => n.tier === currTier);

    for (const currNode of currNodes) {
      const hasIncomingFromEarlier = edges.some((e) => {
        if (e.target !== currNode.id) return false;
        const srcNode = nodeMap.get(e.source);
        return srcNode && srcNode.tier < currTier;
      });

      if (!hasIncomingFromEarlier && prevNodes.length > 0) {
        const p = prevNodes[prevNodes.length - 1];
        const edgeId = `edge-${p.id}->${currNode.id}`;
        if (!edgeSet.has(edgeId) && p.id !== currNode.id) {
          edges.push({
            id: edgeId,
            source: p.id,
            target: currNode.id,
            animated: true,
          });
          edgeSet.add(edgeId);
        }
      }
    }
  }

  // Tier 7 application launch must strictly wait for schema/migrations/seeds if present
  const tier7Nodes = rawNodes.filter((n) => n.tier === 7);
  const preLaunchNodes = rawNodes.filter((n) => n.tier === 6 || n.tier === 5 || n.tier === 4);
  if (preLaunchNodes.length > 0) {
    const highestPreLaunch = preLaunchNodes.reduce((prev, curr) =>
      curr.tier > prev.tier ? curr : prev
    );
    for (const t7 of tier7Nodes) {
      const hasPreLaunchEdge = edges.some(
        (e) => e.target === t7.id && preLaunchNodes.some((p) => p.id === e.source)
      );
      if (!hasPreLaunchEdge && highestPreLaunch.id !== t7.id) {
        const edgeId = `edge-${highestPreLaunch.id}->${t7.id}`;
        if (!edgeSet.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: highestPreLaunch.id,
            target: t7.id,
            animated: true,
          });
          edgeSet.add(edgeId);
        }
      }
    }
  }

  const acyclicEdges = removeCycles(rawNodes, edges);
  const validEdges = transitiveReduction(rawNodes, acyclicEdges);
  const updatedNodes = evaluateNodeStatuses(rawNodes, validEdges);
  const layoutedNodes = computeGraphLayout(updatedNodes);

  // Calculate summary metrics
  const tiersPresent = Array.from(new Set(layoutedNodes.map((n) => n.tier))).sort(
    (a, b) => a - b
  ) as LifecycleTier[];

  let envKeysMissing = 0;
  for (const n of layoutedNodes) {
    if (n.envKeys) {
      envKeysMissing += n.envKeys.filter((e) => e.required && !e.currentValue).length;
    }
  }

  const detectedStacks = Array.from(
    new Set(
      layoutedNodes
        .map((n) => n.provides)
        .flat()
        .map((p) => p.split(":")[0])
    )
  );

  return {
    name: projectName,
    rootPath: workspaceDir,
    nodes: layoutedNodes,
    edges: validEdges,
    createdAt: new Date().toISOString(),
    summary: {
      totalNodes: layoutedNodes.length,
      tiersPresent,
      envKeysMissing,
      detectedStacks,
    },
  };
}

/**
 * Removes edges that would introduce cycles to preserve strict DAG guarantees
 */
function removeCycles(nodes: SetupNode[], edges: DAGEdge[]): DAGEdge[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }

  const resultEdges: DAGEdge[] = [];

  for (const edge of edges) {
    // Check if adding this edge creates a cycle (DFS path from target to source)
    if (hasPath(adj, edge.target, edge.source)) {
      console.warn(
        `[DAG Engine] Pruning cycle-creating edge: ${edge.source} -> ${edge.target}`
      );
      continue;
    }

    adj.get(edge.source)?.push(edge.target);
    resultEdges.push(edge);
  }

  return resultEdges;
}

function hasPath(
  adj: Map<string, string[]>,
  start: string,
  target: string,
  visited = new Set<string>()
): boolean {
  if (start === target) return true;
  if (visited.has(start)) return false;
  visited.add(start);

  const neighbors = adj.get(start) || [];
  for (const next of neighbors) {
    if (hasPath(adj, next, target, visited)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates whether nodes are blocked, ready, or completed based on prerequisite completion
 */
export function evaluateNodeStatuses(
  nodes: SetupNode[],
  edges: DAGEdge[]
): SetupNode[] {
  const completedNodeIds = new Set(
    nodes.filter((n) => n.status === "completed").map((n) => n.id)
  );

  // Map each node to its incoming prerequisites
  const incoming = new Map<string, string[]>();
  for (const node of nodes) {
    incoming.set(node.id, []);
  }
  for (const edge of edges) {
    incoming.get(edge.target)?.push(edge.source);
  }

  return nodes.map((node) => {
    // If already running or completed or failed, don't change
    if (
      node.status === "running" ||
      node.status === "completed" ||
      node.status === "failed" ||
      node.status === "skipped"
    ) {
      return node;
    }

    const prereqs = incoming.get(node.id) || [];
    const allPrereqsMet = prereqs.every((pId) => completedNodeIds.has(pId));

    const nextStatus: NodeStatus = allPrereqsMet ? "ready" : "blocked";
    return {
      ...node,
      status: nextStatus,
    };
  });
}

/**
 * Eliminates redundant transitive edges where an indirect path of length >= 2 already exists
 */
export function transitiveReduction(
  nodes: SetupNode[],
  edges: DAGEdge[]
): DAGEdge[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }

  const resultEdges: DAGEdge[] = [];

  for (const edge of edges) {
    const neighbors = adj.get(edge.source) || [];
    let hasAlternativePath = false;

    for (const intermediate of neighbors) {
      if (intermediate === edge.target) continue;
      if (canReach(adj, intermediate, edge.target)) {
        hasAlternativePath = true;
        break;
      }
    }

    if (!hasAlternativePath) {
      resultEdges.push(edge);
    }
  }

  return resultEdges;
}

function canReach(
  adj: Map<string, string[]>,
  current: string,
  target: string,
  visited = new Set<string>()
): boolean {
  if (current === target) return true;
  if (visited.has(current)) return false;
  visited.add(current);

  const neighbors = adj.get(current) || [];
  for (const next of neighbors) {
    if (canReach(adj, next, target, visited)) {
      return true;
    }
  }
  return false;
}
