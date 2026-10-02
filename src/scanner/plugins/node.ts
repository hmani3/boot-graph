import fs from "node:fs/promises";
import path from "node:path";
import { SetupNode } from "../../core/types.js";
import { OFFICIAL_DOCS, extractFileSnippet } from "../doc-enricher.js";

export async function scanNode(workspaceDir: string): Promise<SetupNode[]> {
  const nodes: SetupNode[] = [];
  const pkgPath = path.join(workspaceDir, "package.json");

  let hasPkg = false;
  let pkgData: any = null;
  try {
    const raw = await fs.readFile(pkgPath, "utf-8");
    pkgData = JSON.parse(raw);
    hasPkg = true;
  } catch {
    // No package.json
  }

  if (!hasPkg) {
    return nodes;
  }

  // Detect package manager based on package.json specification or latest modified lockfile
  const pm = await detectPackageManager(workspaceDir, pkgData);

  let nvmVersion: string | undefined;
  for (const nvmFile of [".nvmrc", ".node-version"]) {
    try {
      const v = await fs.readFile(path.join(workspaceDir, nvmFile), "utf-8");
      nvmVersion = v.trim();
      break;
    } catch {
      // ignore
    }
  }

  const pkgSnippet = await extractFileSnippet(workspaceDir, "package.json", 25);

  nodes.push({
    id: "runtime-node",
    name: `Verify Node.js Runtime${nvmVersion ? ` (${nvmVersion})` : ""}`,
    tier: 1,
    category: "runtime",
    status: "ready",
    command: "node -v",
    description: nvmVersion
      ? `Ensure Node.js version matches repository requirement: ${nvmVersion}.`
      : "Verify that Node.js (>= 18.x recommended) is installed and active on the PATH.",
    rationale: "Required before installing dependencies or executing JavaScript/TypeScript scripts.",
    sourceFile: nvmVersion ? ".nvmrc" : "package.json",
    sourceSnippet: pkgSnippet?.snippet,
    sourceLineRange: pkgSnippet?.lineRange,
    docLinks: [
      ...(OFFICIAL_DOCS.node || []),
      ...(OFFICIAL_DOCS[pm] || []),
    ],
    provides: ["runtime:node", `runtime:node:${nvmVersion || "any"}`],
    requires: [],
    probe: {
      type: "command",
      command: "node -v",
    },
  });

  const installCmd = `${pm} install`;
  nodes.push({
    id: "deps-install",
    name: `Install Dependencies (${pm})`,
    tier: 2,
    category: "package",
    status: "blocked",
    command: installCmd,
    description: `Install all production and development packages specified in package.json using ${pm}.`,
    rationale: "All downstream compilation, database commands, and dev servers rely on node_modules.",
    sourceFile: "package.json",
    sourceSnippet: pkgSnippet?.snippet,
    sourceLineRange: pkgSnippet?.lineRange,
    docLinks: OFFICIAL_DOCS[pm] || OFFICIAL_DOCS.npm,
    provides: ["deps:installed", "deps:node"],
    requires: ["runtime:node"],
  });

  return nodes;
}

async function detectPackageManager(
  workspaceDir: string,
  pkgData: any
): Promise<"pnpm" | "yarn" | "bun" | "npm"> {
  if (pkgData?.packageManager && typeof pkgData.packageManager === "string") {
    const pmField = pkgData.packageManager.toLowerCase();
    if (pmField.startsWith("pnpm")) return "pnpm";
    if (pmField.startsWith("yarn")) return "yarn";
    if (pmField.startsWith("bun")) return "bun";
    if (pmField.startsWith("npm")) return "npm";
  }

  const lockfiles: { file: string; pm: "pnpm" | "yarn" | "bun" | "npm" }[] = [
    { file: "package-lock.json", pm: "npm" },
    { file: "pnpm-lock.yaml", pm: "pnpm" },
    { file: "yarn.lock", pm: "yarn" },
    { file: "bun.lockb", pm: "bun" },
    { file: "bun.lock", pm: "bun" },
  ];

  const found: { pm: "pnpm" | "yarn" | "bun" | "npm"; mtime: number }[] = [];

  for (const candidate of lockfiles) {
    try {
      const stats = await fs.stat(path.join(workspaceDir, candidate.file));
      found.push({ pm: candidate.pm, mtime: stats.mtimeMs });
    } catch {
      // Lockfile does not exist
    }
  }

  if (found.length > 0) {
    found.sort((a, b) => b.mtime - a.mtime);
    return found[0].pm;
  }

  return "npm";
}
