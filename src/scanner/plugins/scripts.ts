import fs from "node:fs/promises";
import path from "node:path";
import { SetupNode } from "../../core/types.js";
import { extractFileSnippet } from "../doc-enricher.js";

export async function scanScripts(workspaceDir: string): Promise<SetupNode[]> {
  const nodes: SetupNode[] = [];
  const pkgPath = path.join(workspaceDir, "package.json");

  let scripts: Record<string, string> = {};
  let pkg: any = {};
  try {
    const raw = await fs.readFile(pkgPath, "utf-8");
    pkg = JSON.parse(raw);
    scripts = pkg.scripts || {};
  } catch {
    return [];
  }

  // Detect package manager runner prefix
  let runner = "npm run";
  try {
    await fs.access(path.join(workspaceDir, "pnpm-lock.yaml"));
    runner = "pnpm";
  } catch {
    try {
      await fs.access(path.join(workspaceDir, "yarn.lock"));
      runner = "yarn";
    } catch {
      runner = "npm run";
    }
  }

  const snippet = await extractFileSnippet(workspaceDir, "package.json", 35);

  const seedKey = Object.keys(scripts).find((k) =>
    /^(db[-:_]?)?seed(:run)?$/i.test(k)
  );

  const hasPrismaSeed = Boolean(pkg.prisma?.seed);

  if (seedKey || hasPrismaSeed) {
    const seedCommand = seedKey ? `${runner} ${seedKey}` : "npx prisma db seed";
    const seedDesc = seedKey
      ? `Execute database seeding script ("${scripts[seedKey]}") to populate initial tables with development fixtures.`
      : `Execute Prisma seed command ("${pkg.prisma?.seed}") to populate initial database fixtures.`;

    nodes.push({
      id: "data-seed",
      name: seedKey ? `Seed Database (${seedKey})` : "Seed Database (prisma db seed)",
      tier: 6,
      category: "seed",
      status: "blocked",
      command: seedCommand,
      description: seedDesc,
      rationale:
        "Seeding populates mock entities, test credentials, and reference tables required for local testing.",
      sourceFile: "package.json",
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: [],
      provides: ["db:seeded"],
      requires: ["db:migrated", "env:configured"],
    });
  }

  const devKey =
    Object.keys(scripts).find((k) => /^dev(:all)?$/i.test(k)) ||
    Object.keys(scripts).find((k) => /^start:dev$/i.test(k)) ||
    Object.keys(scripts).find((k) => /^start$/i.test(k));

  if (devKey) {
    nodes.push({
      id: "app-launch",
      name: `Launch Application (${devKey})`,
      tier: 7,
      category: "app",
      status: "blocked",
      command: `${runner} ${devKey}`,
      description: `Boot the application dev server ("${scripts[devKey]}") with hot reloading and watches.`,
      rationale:
        "Final step: Launches the main web server, API endpoint, or frontend interface.",
      sourceFile: "package.json",
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: [],
      provides: ["app:running"],
      requires: ["deps:installed", "env:configured"],
    });
  }

  return nodes;
}
