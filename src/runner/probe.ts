import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import https from "node:https";
import { ReadinessProbe } from "../core/types.js";

const execAsync = promisify(exec);

export interface ProbeResult {
  success: boolean;
  message: string;
}

export async function executeProbe(
  probe: ReadinessProbe,
  onProgress?: (message: string) => void,
  cwd?: string
): Promise<ProbeResult> {
  const maxRetries = ("maxRetries" in probe && probe.maxRetries) ? probe.maxRetries : 15;
  const retryIntervalMs = ("retryIntervalMs" in probe && probe.retryIntervalMs) ? probe.retryIntervalMs : 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (probe.type === "tcp") {
        onProgress?.(
          `Checking TCP socket ${probe.host}:${probe.port} (attempt ${attempt}/${maxRetries})...`
        );
        const isOpen = await checkTcpPort(probe.host, probe.port, 2000);
        if (isOpen) {
          return {
            success: true,
            message: `Port ${probe.port} on ${probe.host} is open and accepting connections.`,
          };
        }
      } else if (probe.type === "command") {
        onProgress?.(
          `Executing probe command: "${probe.command}" (attempt ${attempt}/${maxRetries})...`
        );
        await execAsync(probe.command, { cwd: cwd || process.cwd() });
        return {
          success: true,
          message: `Probe command "${probe.command}" exited successfully (code 0).`,
        };
      } else if (probe.type === "file") {
        const filePath = cwd && !path.isAbsolute(probe.path) ? path.resolve(cwd, probe.path) : probe.path;
        onProgress?.(`Verifying file existence: ${filePath}...`);
        await fs.access(filePath);
        return {
          success: true,
          message: `File "${filePath}" exists.`,
        };
      } else if (probe.type === "http") {
        onProgress?.(
          `Pinging HTTP endpoint: ${probe.url} (attempt ${attempt}/${maxRetries})...`
        );
        const ok = await checkHttpEndpoint(probe.url, probe.expectedStatus || 200);
        if (ok) {
          return {
            success: true,
            message: `Endpoint ${probe.url} responded with expected status.`,
          };
        }
      }
    } catch (err: any) {
      // Continue retrying
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryIntervalMs));
    }
  }

  return {
    success: false,
    message: `Probe timed out after ${maxRetries} attempts.`,
  };
}

function checkTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(true);
      }
    });

    socket.on("timeout", () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

function checkHttpEndpoint(urlStr: string, expectedStatus = 200): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const requester = parsed.protocol === "https:" ? https : http;

      const req = requester.get(urlStr, (res) => {
        resolve(res.statusCode === expectedStatus);
      });

      req.on("error", () => resolve(false));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
