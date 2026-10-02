import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import { SetupNode } from "../../core/types.js";
import { OFFICIAL_DOCS, extractFileSnippet } from "../doc-enricher.js";

export async function scanDocker(workspaceDir: string): Promise<SetupNode[]> {
  const composeCandidates = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
  ];

  let composeFile: string | undefined;
  let composeRaw = "";

  for (const candidate of composeCandidates) {
    try {
      const full = path.join(workspaceDir, candidate);
      composeRaw = await fs.readFile(full, "utf-8");
      composeFile = candidate;
      break;
    } catch {
      // not found
    }
  }

  if (!composeFile || !composeRaw) {
    return [];
  }

  let parsed: any = null;
  try {
    parsed = yaml.parse(composeRaw);
  } catch {
    return [];
  }

  const nodes: SetupNode[] = [];
  const services = parsed?.services || {};
  const serviceNames = Object.keys(services);

  if (serviceNames.length === 0) {
    return [];
  }

  const provides: string[] = ["service:docker"];
  const docLinks = [...(OFFICIAL_DOCS.docker || [])];
  let primaryDbPort: number | undefined;

  for (const [name, svc] of Object.entries<any>(services)) {
    const img = (svc?.image || "").toLowerCase();
    const svcName = name.toLowerCase();

    // Parse ports
    let mappedPort: number | undefined;
    if (Array.isArray(svc?.ports)) {
      for (const p of svc.ports) {
        const portStr = String(p);
        const match = portStr.match(/^(\d+):(\d+)/);
        if (match) {
          mappedPort = parseInt(match[1], 10);
          provides.push(`port:${mappedPort}`);
          break;
        }
      }
    }

    if (img.includes("postgres") || svcName.includes("postgres") || svcName === "db") {
      provides.push("service:postgres");
      provides.push("service:database");
      docLinks.push(...(OFFICIAL_DOCS.postgres || []));
      if (!primaryDbPort) primaryDbPort = mappedPort || 5432;
    } else if (img.includes("redis") || svcName.includes("redis")) {
      provides.push("service:redis");
      docLinks.push(...(OFFICIAL_DOCS.redis || []));
      if (!primaryDbPort && !provides.includes("service:database")) primaryDbPort = mappedPort || 6379;
    } else if (img.includes("mysql") || svcName.includes("mysql")) {
      provides.push("service:mysql");
      provides.push("service:database");
      if (!primaryDbPort) primaryDbPort = mappedPort || 3306;
    }
  }

  const snippet = await extractFileSnippet(workspaceDir, composeFile, 30);
  const isWin = process.platform === "win32";

  nodes.push({
    id: "runtime-docker",
    name: isWin ? "Verify Docker Desktop (Windows)" : "Verify Docker Engine",
    tier: 1,
    category: "runtime",
    status: "ready",
    command: "docker info",
    description: isWin
      ? "Ensure Docker Desktop is active on Windows. If Docker Desktop is stopped or WSL 2 backend is inactive, start it from the Start menu or click Skip Step."
      : "Ensure the Docker daemon is running and healthy.",
    rationale: "Required before spinning up database containers or microservices.",
    sourceFile: composeFile,
    sourceSnippet: snippet?.snippet,
    sourceLineRange: snippet?.lineRange,
    docLinks: OFFICIAL_DOCS.docker || [],
    provides: ["runtime:docker"],
    requires: [],
    probe: {
      type: "command",
      command: "docker info",
    },
  });

  nodes.push({
    id: "docker-services",
    name: `Start Containers (${serviceNames.slice(0, 3).join(", ")}${
      serviceNames.length > 3 ? "..." : ""
    })`,
    tier: 4,
    category: "service",
    status: "blocked",
    command: "docker compose up -d",
    description: isWin
      ? `Spin up background containers defined in ${composeFile}: ${serviceNames.join(", ")}. If running without Docker Desktop on Windows, use Skip Step to unblock database steps.`
      : `Spin up background containerized services defined in ${composeFile}: ${serviceNames.join(", ")}.`,
    rationale:
      "Databases and caches must be running and listening for incoming connections before schema migrations or apps can start.",
    sourceFile: composeFile,
    sourceSnippet: snippet?.snippet,
    sourceLineRange: snippet?.lineRange,
    docLinks,
    provides,
    requires: ["runtime:docker"],
    probe: primaryDbPort
      ? {
          type: "tcp",
          host: "127.0.0.1",
          port: primaryDbPort,
          timeoutMs: 30000,
          retryIntervalMs: 1500,
          maxRetries: 20,
        }
      : undefined,
  });

  return nodes;
}
