import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { scanWorkspace } from "./index.js";
import { buildDAG } from "../engine/dag.js";

describe("Workspace Scanner & Discovery", () => {
  it("scans workspace and detects setup steps with documentation links", async () => {
    const cwd = process.cwd();
    const { nodes } = await scanWorkspace(cwd);

    assert.ok(nodes.length > 0, "Should detect at least 1 node in current repository");

    // Must find node runtime and dependency installation
    const nodeRuntime = nodes.find((n) => n.id === "runtime-node");
    assert.ok(nodeRuntime, "Should detect Node runtime step");
    assert.equal(nodeRuntime?.tier, 1);
    assert.ok(nodeRuntime?.docLinks.length > 0, "Should include official docs");

    const depsInstall = nodes.find((n) => n.id === "deps-install");
    assert.ok(depsInstall, "Should detect dependency installation step");
    assert.equal(depsInstall?.tier, 2);

    // Build the DAG
    const manifest = buildDAG(nodes, "boot-graph", cwd);
    assert.ok(manifest.edges.length > 0, "Should generate dependency edges");

    const hasEdge = manifest.edges.some(
      (e) => e.source === "runtime-node" && e.target === "deps-install"
    );
    assert.ok(hasEdge, "Edge runtime-node -> deps-install must exist");
  });

  it("scans complex SaaS starter and correctly resolves 7 tiers & dependencies", async () => {
    const fixtureDir = path.resolve(process.cwd(), "examples/saas-starter");
    const { nodes } = await scanWorkspace(fixtureDir);

    const manifest = buildDAG(nodes, "saas-starter", fixtureDir);

    // Verify detected nodes across tiers
    assert.ok(nodes.some((n) => n.id === "runtime-node" && n.tier === 1), "Should detect Node runtime");
    assert.ok(nodes.some((n) => n.id === "runtime-docker" && n.tier === 1), "Should detect Docker runtime");
    assert.ok(nodes.some((n) => n.id === "deps-install" && n.tier === 2), "Should detect Dependency install");
    assert.ok(nodes.some((n) => n.id === "env-config" && n.tier === 3), "Should detect .env config");
    assert.ok(nodes.some((n) => n.id === "docker-services" && n.tier === 4), "Should detect Docker containers");
    assert.ok(nodes.some((n) => n.id === "db-migrate-prisma" && n.tier === 5), "Should detect Prisma migrations");
    assert.ok(nodes.some((n) => n.id === "data-seed" && n.tier === 6), "Should detect DB seeding");
    assert.ok(nodes.some((n) => n.id === "app-launch" && n.tier === 7), "Should detect App dev server");

    // Verify missing env keys
    assert.equal(manifest.summary.envKeysMissing, 2, "Should find 2 missing required env keys (JWT_SECRET, STRIPE_SECRET_KEY)");

    // Verify topological edges
    const dockerToPrisma = manifest.edges.some(
      (e) => e.source === "docker-services" && e.target === "db-migrate-prisma"
    );
    assert.ok(dockerToPrisma, "Docker services must lead into Prisma migrations");

    const prismaToSeed = manifest.edges.some(
      (e) => e.source === "db-migrate-prisma" && e.target === "data-seed"
    );
    assert.ok(prismaToSeed, "Prisma migrations must lead into data seeding");
  });
});
