import { SetupNode, LifecycleTier } from "../core/types.js";

export const TIER_X_OFFSET: Record<LifecycleTier, number> = {
  1: 60,
  2: 620,
  3: 1180,
  4: 1740,
  5: 2300,
  6: 2860,
  7: 3420,
};

export function computeGraphLayout(
  nodes: SetupNode[],
  forceReset = false
): SetupNode[] {
  const tierGroups: Record<number, SetupNode[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };

  for (const node of nodes) {
    const tier = node.tier in tierGroups ? node.tier : 1;
    tierGroups[tier].push(node);
  }

  const updatedNodes: SetupNode[] = [];

  for (let t = 1; t <= 7; t++) {
    const group = tierGroups[t] || [];
    const x = TIER_X_OFFSET[t as LifecycleTier] || 60;

    const appNodes: SetupNode[] = [];
    const infraNodes: SetupNode[] = [];
    const envNodes: SetupNode[] = [];

    for (const node of group) {
      const isInfra =
        node.category === "service" ||
        node.id.includes("docker") ||
        node.id.includes("compose") ||
        node.id.includes("container") ||
        node.id.includes("generate") ||
        node.provides.some(
          (p) =>
            p.startsWith("service:") ||
            p.includes("docker") ||
            p.includes("client")
        ) ||
        Boolean(node.command?.includes("docker"));

      const isEnv =
        !isInfra &&
        (node.category === "env" || node.tier === 3 || node.id.includes("env"));

      if (isInfra) {
        infraNodes.push(node);
      } else if (isEnv) {
        envNodes.push(node);
      } else {
        appNodes.push(node);
      }
    }

    appNodes.forEach((node, idx) => {
      const y = 100 + idx * 280;
      const position = !forceReset && node.position ? node.position : { x, y };
      updatedNodes.push({ ...node, position });
    });

    envNodes.forEach((node, idx) => {
      const y = -80 - idx * 280;
      const position = !forceReset && node.position ? node.position : { x, y };
      updatedNodes.push({ ...node, position });
    });

    infraNodes.forEach((node, idx) => {
      const y = 480 + idx * 280;
      const position = !forceReset && node.position ? node.position : { x, y };
      updatedNodes.push({ ...node, position });
    });
  }

  return updatedNodes;
}
