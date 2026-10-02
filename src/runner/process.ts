import { spawn, ChildProcess } from "node:child_process";

export interface ExecutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onChunk: (chunk: string) => void;
  isDaemon?: boolean;
  onReady?: (durationMs: number) => void;
  onExit?: (code: number | null) => void;
}

export interface ExecutionResult {
  exitCode: number;
  durationMs: number;
}

const READY_PATTERNS = [
  /ready in \d+/i,
  /local:\s+https?:\/\//i,
  /network:\s+https?:\/\//i,
  /listening on/i,
  /server (is )?running/i,
  /started server/i,
  /compiled successfully/i,
  /webpack compiled/i,
  /http:\/\/(localhost|127\.0\.0\.1):\d+/i,
  /press (h \+ enter|ctrl\+c)/i,
];

export class ProcessRunner {
  private activeProcesses = new Map<string, ChildProcess>();

  /**
   * Spawns a command, pipes output chunks with ANSI color preservation, and tracks execution
   */
  public run(
    nodeId: string,
    command: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const isWindows = process.platform === "win32";

      const child = spawn(command, {
        cwd: options.cwd || process.cwd(),
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: "3",
          COLORTERM: "truecolor",
          TERM: "xterm-256color",
          ...options.env,
        },
        detached: !isWindows,
      });

      this.activeProcesses.set(nodeId, child);

      let resolved = false;
      let aggregatedOutput = "";
      let fallbackTimer: NodeJS.Timeout | null = null;

      const triggerReady = () => {
        if (resolved) return;
        resolved = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        const durationMs = Date.now() - startTime;
        options.onReady?.(durationMs);
        resolve({
          exitCode: 0,
          durationMs,
        });
      };

      if (options.isDaemon) {
        // Fallback: if daemon has run steadily for 6 seconds without exiting or erroring, mark ready
        fallbackTimer = setTimeout(() => {
          triggerReady();
        }, 6000);
      }

      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        options.onChunk(text);
        if (options.isDaemon && !resolved) {
          aggregatedOutput += text;
          if (READY_PATTERNS.some((pat) => pat.test(aggregatedOutput))) {
            triggerReady();
          }
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        options.onChunk(text);
        if (options.isDaemon && !resolved) {
          aggregatedOutput += text;
          if (READY_PATTERNS.some((pat) => pat.test(aggregatedOutput))) {
            triggerReady();
          }
        }
      });

      child.on("error", (err) => {
        options.onChunk(`\r\n\x1b[31m[Process Error]: ${err.message}\x1b[0m\r\n`);
      });

      child.on("close", (code) => {
        this.activeProcesses.delete(nodeId);
        if (fallbackTimer) clearTimeout(fallbackTimer);
        options.onExit?.(code);

        if (!resolved) {
          resolved = true;
          const durationMs = Date.now() - startTime;
          resolve({
            exitCode: code ?? 0,
            durationMs,
          });
        }
      });
    });
  }

  public kill(nodeId: string): boolean {
    const child = this.activeProcesses.get(nodeId);
    if (child) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", child.pid!.toString(), "/f", "/t"]);
      } else {
        try {
          if (child.pid) {
            process.kill(-child.pid, "SIGTERM");
          } else {
            child.kill("SIGTERM");
          }
        } catch {
          child.kill("SIGTERM");
        }
      }
      this.activeProcesses.delete(nodeId);
      return true;
    }
    return false;
  }

  public write(nodeId: string, data: string): boolean {
    const child = this.activeProcesses.get(nodeId);
    if (child && child.stdin && child.stdin.writable) {
      child.stdin.write(data);
      return true;
    }
    return false;
  }

  public isRunning(nodeId: string): boolean {
    return this.activeProcesses.has(nodeId);
  }
}

export const runner = new ProcessRunner();
