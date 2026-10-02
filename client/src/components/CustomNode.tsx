import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Terminal,
  BookOpen,
  FileCode,
  ArrowRightCircle,
  SkipForward,
  Undo2,
} from "lucide-react";
import { SetupNode, LIFECYCLE_TIER_NAMES, TIER_THEMES } from "../types";
import { useGraphStore } from "../store/useGraphStore";

export const CustomNode = memo(({ data }: NodeProps<{ node: SetupNode }>) => {
  const node = data.node;
  const { runNode, skipNode, updateNode, setActiveTerminalNodeId, setSelectedNodeId, manifest } =
    useGraphStore();

  const theme = TIER_THEMES[node.tier] || TIER_THEMES[1];

  const getStatusBadge = () => {
    switch (node.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-4 h-4" />
            Completed {node.durationMs ? `(${(node.durationMs / 1000).toFixed(1)}s)` : ""}
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 text-amber-300 border border-amber-800/50">
            <SkipForward className="w-4 h-4" />
            Skipped
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-700 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Running
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700">
            <ArrowRightCircle className="w-4 h-4" />
            Ready
          </span>
        );
      case "blocked":
      default: {
        const incoming = manifest?.edges.filter((e) => e.target === node.id) || [];
        const hasSkippedPrereq = incoming.some((e) => {
          const src = manifest?.nodes.find((n) => n.id === e.source);
          return src?.status === "skipped";
        });

        if (hasSkippedPrereq) {
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/60"
              title="Blocked because an incoming prerequisite was skipped"
            >
              <Lock className="w-4 h-4" />
              Blocked (Skipped Prereq)
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-900 text-gray-400 border border-gray-800">
            <Lock className="w-4 h-4" />
            Blocked
          </span>
        );
      }
    }
  };

  const getBorderColor = () => {
    switch (node.status) {
      case "completed":
        return "border-emerald-600/70 shadow-emerald-950/30";
      case "skipped":
        return "border-slate-700 opacity-70 shadow-slate-950/20";
      case "running":
        return "border-sky-500 shadow-sky-950/50 ring-2 ring-sky-500/30";
      case "failed":
        return "border-rose-600/80 shadow-rose-950/40";
      case "ready":
        return `${theme.border} ring-1 ring-white/10`;
      case "blocked":
      default:
        return "border-gray-800/80 opacity-75";
    }
  };

  const isClickable =
    node.status === "ready" ||
    node.status === "failed" ||
    node.status === "completed" ||
    node.status === "skipped";

  return (
    <div
      className={`relative w-[420px] rounded-xl bg-[#0f172a]/95 backdrop-blur-md border ${getBorderColor()} shadow-xl transition-all duration-200 hover:shadow-2xl hover:border-indigo-400/80 text-gray-200 select-none cursor-grab active:cursor-grabbing overflow-hidden`}
    >
      <div className={`h-2 w-full ${theme.accentBar}`} />

      <Handle
        type="target"
        position={Position.Left}
        style={{ backgroundColor: theme.dotColor }}
        className="!w-4 !h-4 !border-2 !border-slate-900 !rounded-full !-left-2 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ backgroundColor: theme.dotColor }}
        className="!w-4 !h-4 !border-2 !border-slate-900 !rounded-full !-right-2 transition-transform hover:scale-125"
      />

      <div className="p-5 space-y-3.5">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span
            className={`font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-md border ${theme.badge}`}
          >
            {theme.stageLabel} • {theme.name}
          </span>
          {getStatusBadge()}
        </div>

        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2 line-clamp-1">
            {node.name}
          </h3>
          <p className="text-sm text-gray-300 mt-1 line-clamp-2 leading-relaxed">
            {node.description.split("\n")[0]}
          </p>
        </div>

        <div className="bg-slate-950/90 rounded-lg px-3 py-2 border border-slate-800/80 font-mono text-xs text-emerald-300 flex items-center justify-between overflow-hidden">
          <span className="truncate pr-2">$ {node.command}</span>
          {node.sourceFile && (
            <span
              title={`Defined in ${node.sourceFile}`}
              className="flex items-center gap-1.5 text-xs text-gray-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              {node.sourceFile}
            </span>
          )}
        </div>

        {node.docLinks && node.docLinks.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-indigo-300">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="truncate">
              {node.docLinks[0].title}
              {node.docLinks.length > 1 ? ` (+${node.docLinks.length - 1} docs)` : ""}
            </span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 nodrag cursor-default">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTerminalNodeId(node.id);
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-gray-300 hover:text-white transition"
              title="View Live Terminal Logs"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-gray-300 hover:text-white transition"
              title="Inspect Details, Dev Docs & Edit"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            {node.status === "skipped" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode(node.id, { status: "ready" });
                }}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition"
                title="Restore skipped step"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            ) : node.status !== "completed" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skipNode(node.id);
                }}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-gray-400 hover:text-amber-400 transition"
                title="Skip Step"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              runNode(node.id);
            }}
            disabled={!isClickable || node.status === "running"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
              node.status === "running"
                ? "bg-slate-800 text-gray-500 cursor-not-allowed"
                : isClickable
                ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                : "bg-slate-800/50 text-gray-500 cursor-not-allowed"
            }`}
          >
            {node.status === "running" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Step
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
