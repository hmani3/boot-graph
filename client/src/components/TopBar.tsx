import React from "react";
import {
  Play,
  RefreshCw,
  Plus,
  Key,
  Save,
  CheckCircle2,
  FolderGit2,
  Network,
} from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";

export const TopBar: React.FC = () => {
  const {
    manifest,
    connected,
    runAll,
    rescan,
    saveConfig,
    setIsEnvModalOpen,
    setIsAddModalOpen,
  } = useGraphStore();

  const total = manifest?.nodes.length || 0;
  const completed =
    manifest?.nodes.filter((n) => n.status === "completed").length || 0;
  const hasRunning = manifest?.nodes.some((n) => n.status === "running");
  const missingEnv = manifest?.summary?.envKeysMissing || 0;

  return (
    <header className="h-14 border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md px-5 flex items-center justify-between select-none z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Network className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            Boot<span className="text-indigo-400">Graph</span>
          </span>
        </div>

        {manifest && (
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <span className="flex items-center gap-1 text-gray-300 font-medium bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
              {manifest.name}
            </span>
            <span className="text-gray-500 font-mono text-[11px] truncate max-w-xs">
              {manifest.rootPath}
            </span>
          </div>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-gray-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {completed} of {total} steps completed
          </span>
        </div>

        {missingEnv > 0 && (
          <button
            onClick={() => setIsEnvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/80 text-amber-300 hover:bg-amber-900/80 transition"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{missingEnv} missing variables</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsEnvModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-gray-300 border border-slate-800 transition"
          title="Configure environment variables"
        >
          <Key className="w-3.5 h-3.5 text-emerald-400" />
          <span>.env</span>
        </button>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-gray-300 border border-slate-800 transition"
          title="Add custom step to graph"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>Add Step</span>
        </button>

        <button
          onClick={rescan}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-800"
          title="Rescan repository"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={saveConfig}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-800"
          title="Save graph configuration"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          onClick={runAll}
          disabled={hasRunning}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-lg transition ${
            hasRunning
              ? "bg-slate-800 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{hasRunning ? "Executing" : "Run All"}</span>
        </button>

        <div
          className="flex items-center pl-2"
          title={connected ? "Connected" : "Disconnected"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        </div>
      </div>
    </header>
  );
};
