import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { X, Play, Square, Trash2, Terminal as TerminalIcon } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";

export const TerminalDrawer: React.FC = () => {
  const {
    manifest,
    activeTerminalNodeId,
    setActiveTerminalNodeId,
    runNode,
    stopNode,
    sendTerminalInput,
  } = useGraphStore();

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastRenderedLength = useRef<number>(0);

  const node = manifest?.nodes.find((n) => n.id === activeTerminalNodeId);

  useEffect(() => {
    if (!activeTerminalNodeId || !terminalRef.current) return;

    // Initialize xterm
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
        background: "#080c14",
        foreground: "#cbd5e1",
        cursor: "#6366f1",
        selectionBackground: "#312e81",
        black: "#1e293b",
        red: "#f43f5e",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#f8fafc",
      },
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    const onDataDisposable = term.onData((data) => {
      sendTerminalInput(activeTerminalNodeId, data);
    });

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    lastRenderedLength.current = 0;

    // Write existing output
    if (node?.output) {
      term.write(node.output);
      lastRenderedLength.current = node.output.length;
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      onDataDisposable.dispose();
      term.dispose();
      xtermInstance.current = null;
    };
  }, [activeTerminalNodeId, sendTerminalInput]);

  // Stream new incoming chunks
  useEffect(() => {
    if (xtermInstance.current && node?.output) {
      if (node.output.length > lastRenderedLength.current) {
        const newChunk = node.output.slice(lastRenderedLength.current);
        xtermInstance.current.write(newChunk);
        lastRenderedLength.current = node.output.length;
      }
    }
  }, [node?.output]);

  if (!activeTerminalNodeId || !node) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16] border-t border-slate-800 shadow-2xl h-80 flex flex-col transition-transform duration-300">
      {/* Drawer Header */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <TerminalIcon className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-gray-200">{node.name}</span>
          <span className="text-gray-500 font-mono">({node.command})</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 ml-1">
            Interactive
          </span>
        </div>

        <div className="flex items-center gap-2">
          {node.status === "running" ? (
            <button
              onClick={() => stopNode(node.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 text-xs font-medium border border-rose-800 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Terminate
            </button>
          ) : (
            <button
              onClick={() => {
                lastRenderedLength.current = 0;
                xtermInstance.current?.clear();
                runNode(node.id);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
            >
              <Play className="w-3.5 h-3.5" /> Re-run Step
            </button>
          )}

          <button
            onClick={() => {
              xtermInstance.current?.clear();
              lastRenderedLength.current = 0;
            }}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-slate-800 transition"
            title="Clear Terminal"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTerminalNodeId(null)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-slate-800 transition ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div
        className="flex-1 p-3 overflow-hidden cursor-text"
        ref={terminalRef}
        onClick={() => xtermInstance.current?.focus()}
      />
    </div>
  );
};
