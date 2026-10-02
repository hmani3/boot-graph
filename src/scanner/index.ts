import fs from "node:fs/promises";
import path from "node:path";
import { SetupNode, BootGraphConfigFile } from "../core/types.js";
import { scanNode } from "./plugins/node.js";
import { scanEnv } from "./plugins/env.js";
import { scanDocker } from "./plugins/docker.js";
import { scanDatabase } from "./plugins/db.js";
import { scanScripts } from "./plugins/scripts.js";
import { extractReadmeContext } from "./doc-enricher.js";

export async function scanWorkspace(
  workspaceDir: string
): Promise<{ nodes: SetupNode[]; config?: BootGraphConfigFile }> {
  const [nodeNodes, envNodes, dockerNodes, dbNodes, scriptNodes, readmeContexts] =
    await Promise.all([
      scanNode(workspaceDir),
      scanEnv(workspaceDir),
      scanDocker(workspaceDir),
      scanDatabase(workspaceDir),
      scanScripts(workspaceDir),
      extractReadmeContext(workspaceDir),
    ]);

  let allNodes: SetupNode[] = [
    ...nodeNodes,
    ...envNodes,
    ...dockerNodes,
    ...dbNodes,
    ...scriptNodes,
  ];

  for (const node of allNodes) {
    const matchingContext = readmeContexts.find(
      (ctx) => ctx.tier === node.tier
    );
    if (matchingContext && !node.description.includes(matchingContext.sectionTitle)) {
      node.description += `\n\n> **README (${matchingContext.sectionTitle}):**\n> ${matchingContext.content.split("\n").slice(0, 5).join("\n> ")}`;
    }
  }

  let config: BootGraphConfigFile | undefined;
  const configPath = path.join(workspaceDir, ".bootgraph.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    // Config file is optional
  }

  if (config?.overrides) {
    for (const [nodeId, override] of Object.entries(config.overrides)) {
      const idx = allNodes.findIndex((n) => n.id === nodeId);
      if (idx !== -1) {
        if (override.enabled === false) {
          allNodes.splice(idx, 1);
        } else {
          allNodes[idx] = {
            ...allNodes[idx],
            ...(override.command ? { command: override.command } : {}),
            ...(override.tier ? { tier: override.tier } : {}),
            ...(override.requires ? { requires: override.requires } : {}),
            ...(override.provides ? { provides: override.provides } : {}),
          };
        }
      }
    }
  }

  if (config?.customNodes) {
    for (const custom of config.customNodes) {
      allNodes.push({
        id: custom.id,
        name: custom.name,
        tier: custom.tier,
        category: custom.category || "custom",
        status: "blocked",
        command: custom.command,
        description: custom.description || "Custom configuration step",
        docLinks: [],
        provides: custom.provides || [],
        requires: custom.requires || [],
      });
    }
  }

  return { nodes: allNodes, config };
}
