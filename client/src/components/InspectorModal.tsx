import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  BookOpen,
  FileCode,
  Terminal,
  Check,
  Trash2,
  CheckCircle2,
  Info,
  Clock,
  Layers,
  SkipForward,
  Network,
  Unlink,
} from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { LIFECYCLE_TIER_NAMES, LifecycleTier } from "../types";

export const InspectorModal: React.FC = () => {
  const {
    manifest,
    selectedNodeId,
    setSelectedNodeId,
    updateNode,
    deleteNode,
    disconnectNodes,
    runNode,
    skipNode,
    setActiveTerminalNodeId,
  } = useGraphStore();

  const node = manifest?.nodes.find((n) => n.id === selectedNodeId);

  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState<LifecycleTier>(1);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (node) {
      setCommand(node.command);
      setDescription(node.description);
      setTier(node.tier);
    }
  }, [node]);

  if (!node) return null;

  const handleApply = () => {
    updateNode(node.id, {
      command,
      description,
      tier,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to remove "${node.name}" from the graph?`)) {
      deleteNode(node.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                {node.name}
              </h2>
              <p className="text-xs text-indigo-400 font-mono">ID: {node.id}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-6 text-sm text-gray-300">
          {node.rationale && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-900/60 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-indigo-200 text-xs uppercase tracking-wide">
                  Prerequisite rationale
                </h4>
                <p className="text-xs text-indigo-300/90 mt-1 leading-relaxed">
                  {node.rationale}
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <Network className="w-4 h-4 text-indigo-400" />
                Prerequisites & Dependencies
              </span>
              <span className="text-[11px] text-gray-500 font-normal">
                {manifest?.edges.filter((e) => e.target === node.id).length || 0} incoming
              </span>
            </h3>

            {(() => {
              const incoming = manifest?.edges.filter((e) => e.target === node.id) || [];
              if (incoming.length === 0) {
                return (
                  <p className="text-xs text-gray-500 italic bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    No prerequisites required. This step runs independently.
                  </p>
                );
              }

              return (
                <div className="space-y-2">
                  {incoming.map((edge) => {
                    const src = manifest?.nodes.find((n) => n.id === edge.source);
                    const isSkipped = src?.status === "skipped";
                    const isCompleted = src?.status === "completed";
                    const isFailed = src?.status === "failed";

                    return (
                      <div
                        key={edge.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition ${
                          isSkipped
                            ? "bg-amber-950/20 border-amber-900/60"
                            : isCompleted
                            ? "bg-emerald-950/20 border-emerald-900/40"
                            : isFailed
                            ? "bg-rose-950/20 border-rose-900/60"
                            : "bg-slate-900/80 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-medium text-gray-200">
                            {src?.name || edge.source}
                          </span>
                          {src && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                isCompleted
                                  ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                                  : isSkipped
                                  ? "bg-amber-950 text-amber-300 border-amber-800/60"
                                  : isFailed
                                  ? "bg-rose-950 text-rose-400 border-rose-800/60"
                                  : "bg-slate-900 text-gray-400 border-slate-700"
                              }`}
                            >
                              {isSkipped
                                ? "Skipped (Blocks step)"
                                : src.status.charAt(0).toUpperCase() + src.status.slice(1)}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => disconnectNodes(edge.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 transition"
                          title="Disconnect this prerequisite to allow running independently"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Separate</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Technical documentation
            </h3>
            {node.docLinks && node.docLinks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {node.docLinks.map((doc, idx) => (
                  <a
                    key={idx}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-850 transition flex items-start justify-between group"
                  >
                    <div>
                      <span className="font-medium text-xs text-gray-100 group-hover:text-indigo-300 transition flex items-center gap-1.5">
                        {doc.title}
                        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-indigo-400" />
                      </span>
                      {doc.description && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                No external documentation links registered for this custom task.
              </p>
            )}
          </div>

          {node.sourceFile && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Source context ({node.sourceFile})
                </h3>
              </div>
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs text-gray-300 overflow-x-auto max-h-48">
                <pre>{node.sourceSnippet || `File reference: ${node.sourceFile}`}</pre>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Command configuration
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Command:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                  placeholder="e.g. npm test"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Lifecycle Tier:
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(parseInt(e.target.value, 10) as LifecycleTier)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-gray-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                >
                  {([1, 2, 3, 4, 5, 6, 7] as LifecycleTier[]).map((t) => (
                    <option key={t} value={t}>
                      Tier {t}: {LIFECYCLE_TIER_NAMES[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Description:
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-gray-200 text-xs focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 border border-rose-900/60 transition"
            >
              <Trash2 className="w-4 h-4" /> Remove Step
            </button>
            {node.status !== "completed" && node.status !== "skipped" && (
              <button
                onClick={() => {
                  skipNode(node.id);
                  setSelectedNodeId(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                <SkipForward className="w-4 h-4" /> Skip Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 animate-fade-in font-medium">
                <CheckCircle2 className="w-4 h-4" /> Applied
              </span>
            )}
            <button
              onClick={() => {
                setActiveTerminalNodeId(node.id);
                setSelectedNodeId(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 transition"
            >
              <Terminal className="w-4 h-4" /> View Terminal
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow"
            >
              <Check className="w-4 h-4" /> Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
