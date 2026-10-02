import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDAG, evaluateNodeStatuses } from "./dag.js";
import { SetupNode } from "../core/types.js";

describe("DAG Engine & Topological Resolution", () => {
  it("resolves edges correctly based on capability contracts", () => {
    const rawNodes: SetupNode[] = [
      {
        id: "node-runtime",
        name: "Verify Node",
        tier: 1,
        category: "runtime",
        status: "ready",
        command: "node -v",
        description: "Node check",
        docLinks: [],
        provides: ["runtime:node"],
        requires: [],
      },
      {
        id: "deps-install",
        name: "Install Packages",
        tier: 2,
        category: "package",
        status: "blocked",
        command: "npm install",
        description: "npm install",
        docLinks: [],
        provides: ["deps:installed"],
        requires: ["runtime:node"],
      },
      {
        id: "db-migrate",
        name: "Run Migrations",
        tier: 5,
        category: "db",
        status: "blocked",
        command: "npx prisma migrate dev",
        description: "Prisma migrate",
        docLinks: [],
        provides: ["db:migrated"],
        requires: ["deps:installed"],
      },
    ];

    const manifest = buildDAG(rawNodes, "test-repo", "/test");

    assert.equal(manifest.nodes.length, 3);
    assert.equal(manifest.edges.length, 2);

    const edge1 = manifest.edges.find(
      (e) => e.source === "node-runtime" && e.target === "deps-install"
    );
    assert.ok(edge1, "Edge from runtime to deps should exist");

    const edge2 = manifest.edges.find(
      (e) => e.source === "deps-install" && e.target === "db-migrate"
    );
    assert.ok(edge2, "Edge from deps to db-migrate should exist");
  });

  it("prunes cycles if circular dependencies are introduced", () => {
    const cyclicalNodes: SetupNode[] = [
      {
        id: "task-a",
        name: "Task A",
        tier: 2,
        category: "custom",
        status: "blocked",
        command: "echo A",
        description: "A",
        docLinks: [],
        provides: ["cap:a"],
        requires: ["cap:b"],
      },
      {
        id: "task-b",
        name: "Task B",
        tier: 2,
        category: "custom",
        status: "blocked",
        command: "echo B",
        description: "B",
        docLinks: [],
        provides: ["cap:b"],
        requires: ["cap:a"],
      },
    ];

    const manifest = buildDAG(cyclicalNodes, "cycle-test", "/test");

    // Only one edge should be permitted, the back-edge creating the cycle must be pruned
    assert.equal(manifest.edges.length, 1);
  });

  it("evaluates ready vs blocked statuses accurately", () => {
    const nodes: SetupNode[] = [
      {
        id: "node-1",
        name: "Prereq",
        tier: 1,
        category: "runtime",
        status: "completed",
        command: "node -v",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
      {
        id: "node-2",
        name: "Downstream",
        tier: 2,
        category: "package",
        status: "blocked",
        command: "npm install",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
    ];

    const edges = [{ id: "e1", source: "node-1", target: "node-2" }];
    const evaluated = evaluateNodeStatuses(nodes, edges);

    const downstream = evaluated.find((n) => n.id === "node-2");
    assert.equal(downstream?.status, "ready");
  });

  it("keeps downstream nodes blocked when a prerequisite is skipped until separated", () => {
    const nodes: SetupNode[] = [
      {
        id: "node-1",
        name: "Docker Daemon",
        tier: 1,
        category: "runtime",
        status: "skipped",
        command: "docker -v",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
      {
        id: "node-2",
        name: "Docker Services",
        tier: 4,
        category: "service",
        status: "blocked",
        command: "docker compose up -d",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
    ];

    // Connected: node-2 must remain blocked because node-1 was skipped and not completed
    const edges = [{ id: "e1", source: "node-1", target: "node-2" }];
    const evaluatedBlocked = evaluateNodeStatuses(nodes, edges);
    const downstreamBlocked = evaluatedBlocked.find((n) => n.id === "node-2");
    assert.equal(downstreamBlocked?.status, "blocked");

    // Separated: when edge is removed, node-2 unblocks
    const evaluatedSeparated = evaluateNodeStatuses(nodes, []);
    const downstreamSeparated = evaluatedSeparated.find((n) => n.id === "node-2");
    assert.equal(downstreamSeparated?.status, "ready");
  });

  it("computes non-colliding layout spacing and preserves custom positions", async () => {
    const { computeGraphLayout } = await import("./layout.js");

    const nodes: SetupNode[] = [
      {
        id: "t1-a",
        name: "Tier 1 Node A",
        tier: 1,
        category: "runtime",
        status: "ready",
        command: "node -v",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
      {
        id: "t1-b",
        name: "Tier 1 Node B",
        tier: 1,
        category: "runtime",
        status: "ready",
        command: "docker -v",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
      {
        id: "t2-a",
        name: "Tier 2 Node",
        tier: 2,
        category: "package",
        status: "blocked",
        command: "npm install",
        description: "",
        docLinks: [],
        provides: [],
        requires: [],
      },
    ];

    const initialLayout = computeGraphLayout(nodes);
    const node1A = initialLayout.find((n) => n.id === "t1-a")!;
    const node1B = initialLayout.find((n) => n.id === "t1-b")!;
    const node2A = initialLayout.find((n) => n.id === "t2-a")!;

    assert.ok(node1A.position && node1B.position && node2A.position);
    // Vertical spacing between tier 1 nodes should be at least 300px
    assert.ok(Math.abs(node1B.position.y - node1A.position.y) >= 300);
    // Horizontal spacing between tier 1 and tier 2 should be at least 400px
    assert.ok(node2A.position.x - node1A.position.x >= 400);

    // Verify preservation of custom dragged position
    const customNodes: SetupNode[] = [
      { ...node1A, position: { x: 999, y: 888 } },
      node1B,
    ];
    const preserved = computeGraphLayout(customNodes, false);
    assert.deepEqual(preserved.find((n) => n.id === "t1-a")?.position, {
      x: 999,
      y: 888,
    });

    // Verify forced reset recalculates standard positions
    const reset = computeGraphLayout(customNodes, true);
    assert.notDeepEqual(reset.find((n) => n.id === "t1-a")?.position, {
      x: 999,
      y: 888,
    });
  });
});
