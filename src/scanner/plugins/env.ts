import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { SetupNode, EnvVariableEntry } from "../../core/types.js";
import { OFFICIAL_DOCS, extractFileSnippet } from "../doc-enricher.js";

export async function scanEnv(workspaceDir: string): Promise<SetupNode[]> {
  const exampleCandidates = [
    ".env.example",
    ".env.template",
    ".env.sample",
    ".env.dist",
    ".env.local.example",
  ];

  let exampleFile: string | undefined;
  let exampleContent = "";

  for (const candidate of exampleCandidates) {
    try {
      const full = path.join(workspaceDir, candidate);
      exampleContent = await fs.readFile(full, "utf-8");
      exampleFile = candidate;
      break;
    } catch {
      // not found
    }
  }

  // Also read actual .env if present
  let activeEnv: Record<string, string> = {};
  let hasActualEnv = false;
  const actualEnvPath = path.join(workspaceDir, ".env");
  try {
    const rawActual = await fs.readFile(actualEnvPath, "utf-8");
    activeEnv = dotenv.parse(rawActual);
    hasActualEnv = true;
  } catch {
    // No .env yet
  }

  if (!exampleFile && !hasActualEnv) {
    return [];
  }

  const envKeys: EnvVariableEntry[] = [];

  if (exampleContent) {
    const parsedExample = dotenv.parse(exampleContent);
    const lines = exampleContent.split("\n");

    for (const [key, defVal] of Object.entries(parsedExample)) {
      // Look for comment preceding or on line
      let comment = "";
      for (const line of lines) {
        if (line.trim().startsWith("#") && lines[lines.indexOf(line) + 1]?.includes(key)) {
          comment = line.replace(/^#\s*/, "").trim();
        }
      }

      const current = activeEnv[key];
      const isMissing = (!current || current.trim() === "") && (!defVal || defVal.trim() === "");

      envKeys.push({
        key,
        required: isMissing,
        defaultValue: defVal,
        currentValue: current || defVal || "",
        description: comment || undefined,
      });
    }
  } else {
    // Only actual .env exists
    for (const [key, val] of Object.entries(activeEnv)) {
      envKeys.push({
        key,
        required: false,
        currentValue: val,
      });
    }
  }

  const missingCount = envKeys.filter((e) => e.required && !e.currentValue).length;
  const fileSnippet = exampleFile
    ? await extractFileSnippet(workspaceDir, exampleFile, 25)
    : undefined;

  const node: SetupNode = {
    id: "env-config",
    name: "Configure Environment (.env)",
    tier: 3,
    category: "env",
    status: "blocked",
    command: exampleFile
      ? `node -e "const fs=require('fs');if(!fs.existsSync('.env'))fs.copyFileSync('${exampleFile}','.env')"`
      : "node -e \"console.log('Environment already configured')\"",
    description:
      missingCount > 0
        ? `Detected ${missingCount} unset environment variables from ${exampleFile || ".env"}. Configure them directly in the inspector.`
        : "All environment variables match the expected template.",
    rationale:
      "Modern applications crash silently or fail DB handshakes when secrets and URLs are missing.",
    sourceFile: exampleFile || ".env",
    sourceSnippet: fileSnippet?.snippet,
    sourceLineRange: fileSnippet?.lineRange,
    docLinks: OFFICIAL_DOCS.env || [],
    provides: ["env:configured"],
    requires: ["runtime:node"],
    envKeys,
    probe: {
      type: "file",
      path: ".env",
    },
  };

  return [node];
}
