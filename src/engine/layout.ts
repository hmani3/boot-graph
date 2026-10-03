import { SetupNode, LifecycleTier } from "../core/types.js";

export const TIER_X_OFFSET: Record<LifecycleTier, number> = {
  1: 60,
  2: 540,
  3: 580,
  4: 680,
  5: 1220,
  6: 1720,
  7: 2220,
};

export function computeGraphLayout(
  nodes: SetupNode[],
  forceReset = false
): SetupNode[] {
  const result: SetupNode[] = [];
  const appRuntimes: SetupNode[] = [];
  const infraRuntimes: SetupNode[] = [];
  const envNodes: SetupNode[] = [];
  const packageNodes: SetupNode[] = [];
  const infraServices: SetupNode[] = [];
  const migrationNodes: SetupNode[] = [];
  const generateNodes: SetupNode[] = [];
  const seedNodes: SetupNode[] = [];
  const launchNodes: SetupNode[] = [];
  const otherNodes: SetupNode[] = [];

  for (const node of nodes) {
    const isInfra =
      node.category === "service" ||
      node.id.includes("docker") ||
      node.id.includes("compose") ||
      node.id.includes("container") ||
      node.provides.some(
        (p) => p.startsWith("service:") || p.includes("docker")
      ) ||
      Boolean(node.command?.includes("docker"));

    if (node.tier === 1 || node.category === "runtime") {
      if (isInfra) {
        infraRuntimes.push(node);
      } else {
        appRuntimes.push(node);
      }
    } else if (
      node.tier === 3 ||
      node.category === "env" ||
      node.id.includes("env")
    ) {
      envNodes.push(node);
    } else if (
      node.tier === 2 ||
      node.category === "package" ||
      node.id.includes("install") ||
      node.id.includes("deps")
    ) {
      packageNodes.push(node);
    } else if (node.tier === 4 || node.category === "service" || isInfra) {
      infraServices.push(node);
    } else if (node.tier === 5 || node.category === "db") {
      if (
        node.id.includes("generate") ||
        node.id.includes("client") ||
        (node.provides || []).some((p) => p.includes("client"))
      ) {
        generateNodes.push(node);
      } else {
        migrationNodes.push(node);
      }
    } else if (
      node.tier === 6 ||
      node.category === "seed" ||
      node.id.includes("seed")
    ) {
      seedNodes.push(node);
    } else if (
      node.tier === 7 ||
      node.category === "app" ||
      node.id.includes("launch") ||
      node.id.includes("dev") ||
      node.id.includes("start")
    ) {
      launchNodes.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  const hasInfraServices = infraServices.length > 0 || infraRuntimes.length > 0;

  const place = (node: SetupNode, defaultPos: { x: number; y: number }) => {
    const position = !forceReset && node.position ? node.position : defaultPos;
    result.push({ ...node, position });
  };

  const VERTICAL_STEP = 370;

  // Col 0: Runtimes
  const xRuntime = 60;
  appRuntimes.forEach((node, idx) => {
    place(node, { x: xRuntime, y: 220 + idx * VERTICAL_STEP });
  });
  const infraRuntimeStartY = Math.max(
    770,
    220 + appRuntimes.length * VERTICAL_STEP
  );
  infraRuntimes.forEach((node, idx) => {
    place(node, { x: xRuntime, y: infraRuntimeStartY + idx * VERTICAL_STEP });
  });

  // Col 1: Setup Phase (Environment, Packages, Containers)
  const xEnv = hasInfraServices ? 580 : 560;
  const xDeps = 540;
  const xInfraService = 680;

  envNodes.forEach((node, idx) => {
    place(node, { x: xEnv, y: 30 + idx * VERTICAL_STEP });
  });
  const packageStartY = Math.max(400, 30 + envNodes.length * VERTICAL_STEP);
  packageNodes.forEach((node, idx) => {
    place(node, { x: xDeps, y: packageStartY + idx * VERTICAL_STEP });
  });
  const infraServiceStartY = Math.max(
    770,
    packageStartY + packageNodes.length * VERTICAL_STEP
  );
  infraServices.forEach((node, idx) => {
    place(node, {
      x: xInfraService,
      y: infraServiceStartY + idx * VERTICAL_STEP,
    });
  });

  // Col 2: Schema & Migrations / Build (Tier 5)
  const xDatabase = hasInfraServices ? 1220 : 1100;
  migrationNodes.forEach((node, idx) => {
    place(node, { x: xDatabase, y: 220 + idx * VERTICAL_STEP });
  });
  const generateStartY = Math.max(
    590,
    220 + migrationNodes.length * VERTICAL_STEP
  );
  generateNodes.forEach((node, idx) => {
    place(node, { x: xDatabase, y: generateStartY + idx * VERTICAL_STEP });
  });

  // Col 3: Data Seeding (Tier 6)
  const hasTier5 = migrationNodes.length > 0 || generateNodes.length > 0;
  const xSeed =
    (hasTier5 ? xDatabase : hasInfraServices ? 1220 : 1100) + 500;
  seedNodes.forEach((node, idx) => {
    place(node, { x: xSeed, y: 220 + idx * VERTICAL_STEP });
  });

  // Col 4: Application Launch (Tier 7)
  const hasTier6 = seedNodes.length > 0;
  const xLaunch =
    (hasTier6
      ? xSeed
      : hasTier5
      ? xDatabase
      : hasInfraServices
      ? 1220
      : 1100) + 500;
  launchNodes.forEach((node, idx) => {
    place(node, { x: xLaunch, y: 220 + idx * VERTICAL_STEP });
  });

  otherNodes.forEach((node, idx) => {
    place(node, { x: xLaunch + 500, y: 220 + idx * VERTICAL_STEP });
  });

  return result;
}
