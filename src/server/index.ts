import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import picocolors from "picocolors";

import {
  BootGraphManifest,
  BootGraphConfigFile,
  ClientMessage,
  ServerMessage,
  SetupNode,
  DAGEdge,
} from "../core/types.js";
import { scanWorkspace } from "../scanner/index.js";
import { buildDAG, evaluateNodeStatuses } from "../engine/dag.js";
import { computeGraphLayout } from "../engine/layout.js";
import { runner } from "../runner/process.js";
import { executeProbe } from "../runner/probe.js";

export interface ServerOptions {
  port: number;
  workspaceDir: string;
}

export async function startServer(options: ServerOptions) {
  const { port, workspaceDir } = options;
  const projectName = path.basename(workspaceDir);

  // Initial Scan
  const { nodes: initialNodes, config: initialConfig } = await scanWorkspace(workspaceDir);
  let currentManifest = buildDAG(initialNodes, projectName, workspaceDir);
  let currentConfig: BootGraphConfigFile = initialConfig || { overrides: {}, customNodes: [] };

  const app = new Hono();

  // Basic REST endpoints
  app.get("/api/health", (c) => c.json({ status: "ok", name: "BootGraph" }));
  app.get("/api/manifest", (c) => c.json(currentManifest));

  // Determine static files directory (bundled client)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDistDir = path.resolve(__dirname, "../../client/dist");
  const fallbackClientDir = path.resolve(__dirname, "../client");

  app.get("*", async (c) => {
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    let target = path.join(clientDistDir, reqPath);

    try {
      await fs.access(target);
    } catch {
      target = path.join(fallbackClientDir, reqPath);
      try {
        await fs.access(target);
      } catch {
        target = path.join(clientDistDir, "index.html");
      }
    }

    try {
      const content = await fs.readFile(target);
      const ext = path.extname(target);
      const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      return c.body(content, 200, {
        "Content-Type": mimeTypes[ext] || "text/plain",
      });
    } catch {
      return c.text("BootGraph canvas bundle is compiling or unavailable.", 404);
    }
  });

  const server = serve({
    fetch: app.fetch,
    port,
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server: server as unknown as http.Server });
  const clients = new Set<WebSocket>();

  const broadcast = (msg: ServerMessage) => {
    const payload = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  const updateNode = (nodeId: string, updates: Partial<SetupNode>) => {
    const idx = currentManifest.nodes.findIndex((n) => n.id === nodeId);
    if (idx !== -1) {
      currentManifest.nodes[idx] = {
        ...currentManifest.nodes[idx],
        ...updates,
      };
    }
  };

  const broadcastGraphUpdate = () => {
    currentManifest.nodes = evaluateNodeStatuses(
      currentManifest.nodes,
      currentManifest.edges
    );
    broadcast({ type: "GRAPH_UPDATED", manifest: currentManifest });
  };

  // Run a single node
  const executeNode = async (nodeId: string, commandOverride?: string): Promise<boolean> => {
    const node = currentManifest.nodes.find((n) => n.id === nodeId);
    if (!node) return false;

    const cmdToRun = commandOverride || node.command;
    updateNode(nodeId, { status: "running", output: "" });
    broadcast({ type: "NODE_STATUS_CHANGE", nodeId, status: "running" });

    broadcast({
      type: "TERMINAL_OUTPUT",
      nodeId,
      chunk: `\r\n\x1b[36m[exec] ${node.name}: \x1b[1m${cmdToRun}\x1b[0m\r\n\r\n`,
    });

    const isDaemon =
      node.tier === 7 ||
      node.category === "app" ||
      Boolean(node.command?.includes(" dev")) ||
      Boolean(node.command?.includes(" start"));

    const result = await runner.run(nodeId, cmdToRun, {
      cwd: workspaceDir,
      isDaemon,
      onChunk: (chunk) => {
        const target = currentManifest.nodes.find((n) => n.id === nodeId);
        if (target) {
          target.output = (target.output || "") + chunk;
        }
        broadcast({ type: "TERMINAL_OUTPUT", nodeId, chunk });
      },
      onExit: (code) => {
        if (code !== 0 && code !== null) {
          const current = currentManifest.nodes.find((n) => n.id === nodeId);
          if (current && current.status === "completed") {
            updateNode(nodeId, { status: "failed", exitCode: code });
            broadcast({
              type: "NODE_STATUS_CHANGE",
              nodeId,
              status: "failed",
              exitCode: code,
            });
            broadcastGraphUpdate();
          }
        }
      },
    });

    let probePassed = true;
    if (result.exitCode === 0 && node.probe) {
      broadcast({
        type: "PROBE_STATUS",
        nodeId,
        probing: true,
        message: "Verifying readiness probe...",
      });
      const probeRes = await executeProbe(
        node.probe,
        (msg) => {
          broadcast({
            type: "TERMINAL_OUTPUT",
            nodeId,
            chunk: `\x1b[33m[probe] ${msg}\x1b[0m\r\n`,
          });
        },
        workspaceDir
      );
      probePassed = probeRes.success;
      broadcast({
        type: "PROBE_STATUS",
        nodeId,
        probing: false,
        success: probePassed,
        message: probeRes.message,
      });
    }

    if (result.exitCode !== 0) {
      const nodeOut = currentManifest.nodes.find((n) => n.id === nodeId)?.output || "";
      if (
        nodeOut.includes("dockerDesktopLinuxEngine") ||
        nodeOut.includes("pipe/docker_engine") ||
        nodeOut.includes("This error may indicate that the docker daemon is not running")
      ) {
        broadcast({
          type: "TERMINAL_OUTPUT",
          nodeId,
          chunk: `\r\n\x1b[33m[diagnostic] Docker daemon is not active on this Windows host.\x1b[0m\r\n\x1b[33m[diagnostic] Start Docker Desktop from the Start menu, or click "Skip" in the interface to proceed without local containers.\x1b[0m\r\n`,
        });
      }
    }

    // Verify if step was marked skipped during execution
    const nodeAfterRun = currentManifest.nodes.find((n) => n.id === nodeId);
    if (nodeAfterRun?.status === "skipped") {
      broadcastGraphUpdate();
      return false;
    }

    const finalStatus = result.exitCode === 0 && probePassed ? "completed" : "failed";
    updateNode(nodeId, {
      status: finalStatus,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
    });

    broadcast({
      type: "NODE_STATUS_CHANGE",
      nodeId,
      status: finalStatus,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
    });

    broadcastGraphUpdate();
    return finalStatus === "completed";
  };

  // Run all unblocked tasks strictly ordered by lifecycle tier
  let isAutoBooting = false;
  const runAutoBoot = async () => {
    if (isAutoBooting) return;
    isAutoBooting = true;

    try {
      while (isAutoBooting) {
        currentManifest.nodes = evaluateNodeStatuses(
          currentManifest.nodes,
          currentManifest.edges
        );
        const readyNodes = currentManifest.nodes.filter(
          (n) => n.status === "ready"
        );

        if (readyNodes.length === 0) {
          break;
        }

        // Execute lowest tier first (Tier 1 runtimes through Tier 7 launch)
        const lowestTier = Math.min(...readyNodes.map((n) => n.tier));
        const tierBatch = readyNodes.filter((n) => n.tier === lowestTier);

        for (const node of tierBatch) {
          if (!isAutoBooting) break;

          const current = currentManifest.nodes.find((n) => n.id === node.id);
          if (current?.status !== "ready") continue;

          const succeeded = await executeNode(node.id);
          if (!succeeded) {
            const afterRun = currentManifest.nodes.find((n) => n.id === node.id);
            if (afterRun?.status === "failed") {
              return;
            }
          }
        }
      }
    } finally {
      isAutoBooting = false;
      broadcastGraphUpdate();
    }
  };

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Send initial graph state
    ws.send(
      JSON.stringify({
        type: "GRAPH_INIT",
        manifest: currentManifest,
        config: currentConfig,
      } as ServerMessage)
    );

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.type) {
          case "RUN_NODE":
            await executeNode(msg.nodeId, msg.commandOverride);
            break;

          case "SKIP_NODE":
            runner.kill(msg.nodeId);
            updateNode(msg.nodeId, { status: "skipped" });
            broadcast({
              type: "NODE_STATUS_CHANGE",
              nodeId: msg.nodeId,
              status: "skipped",
            });
            broadcastGraphUpdate();
            break;

          case "RUN_ALL":
            runAutoBoot();
            break;

          case "STOP_NODE":
            runner.kill(msg.nodeId);
            updateNode(msg.nodeId, { status: "ready" });
            broadcast({
              type: "NODE_STATUS_CHANGE",
              nodeId: msg.nodeId,
              status: "ready",
            });
            broadcastGraphUpdate();
            break;

          case "TERMINAL_INPUT":
            runner.write(msg.nodeId, msg.data);
            break;

          case "UPDATE_NODE":
            updateNode(msg.nodeId, msg.updates);
            broadcastGraphUpdate();
            break;

          case "RESET_LAYOUT":
            currentManifest.nodes = computeGraphLayout(currentManifest.nodes, true);
            broadcastGraphUpdate();
            break;

          case "ADD_NODE":
            currentManifest.nodes.push(msg.node);
            currentManifest.nodes = computeGraphLayout(currentManifest.nodes);
            broadcastGraphUpdate();
            break;

          case "DELETE_NODE":
            currentManifest.nodes = currentManifest.nodes.filter(
              (n) => n.id !== msg.nodeId
            );
            currentManifest.edges = currentManifest.edges.filter(
              (e) => e.source !== msg.nodeId && e.target !== msg.nodeId
            );
            currentManifest.nodes = computeGraphLayout(currentManifest.nodes);
            broadcastGraphUpdate();
            break;

          case "CONNECT_NODES": {
            const edgeId = `edge-${msg.source}->${msg.target}`;
            const exists = currentManifest.edges.some((e) => e.id === edgeId);
            if (!exists) {
              currentManifest.edges.push({
                id: edgeId,
                source: msg.source,
                target: msg.target,
                animated: true,
              });
              broadcastGraphUpdate();
            }
            break;
          }

          case "DISCONNECT_NODES":
            currentManifest.edges = currentManifest.edges.filter(
              (e) => e.id !== msg.edgeId
            );
            broadcastGraphUpdate();
            break;

          case "SAVE_ENV": {
            const envPath = path.join(workspaceDir, ".env");
            let envText = "";
            for (const [k, v] of Object.entries(msg.entries)) {
              envText += `${k}=${v}\n`;
            }
            await fs.writeFile(envPath, envText, "utf-8");

            // Mark env node completed
            updateNode("env-config", { status: "completed" });
            ws.send(JSON.stringify({ type: "ENV_SAVED", success: true }));
            broadcastGraphUpdate();
            break;
          }

          case "SAVE_CONFIG": {
            const configPath = path.join(workspaceDir, ".bootgraph.json");
            const toSave: BootGraphConfigFile = {
              $schema: "https://bootgraph.dev/schema.json",
              name: projectName,
              overrides: {},
              customNodes: currentManifest.nodes
                .filter((n) => n.category === "custom")
                .map((n) => ({
                  id: n.id,
                  name: n.name,
                  tier: n.tier,
                  category: n.category,
                  command: n.command,
                  description: n.description,
                  requires: n.requires,
                  provides: n.provides,
                })),
            };

            for (const n of currentManifest.nodes) {
              if (n.category !== "custom") {
                toSave.overrides![n.id] = {
                  command: n.command,
                  tier: n.tier,
                };
              }
            }

            await fs.writeFile(
              configPath,
              JSON.stringify(toSave, null, 2),
              "utf-8"
            );
            break;
          }

          case "RESCAN": {
            const scanned = await scanWorkspace(workspaceDir);
            currentManifest = buildDAG(scanned.nodes, projectName, workspaceDir);
            broadcastGraphUpdate();
            break;
          }
        }
      } catch (err: any) {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            message: err.message,
          } as ServerMessage)
        );
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  return { server, wss, manifest: currentManifest };
}
