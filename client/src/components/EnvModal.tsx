import React, { useState, useEffect } from "react";
import { X, Key, Save, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";

export const EnvModal: React.FC = () => {
  const { manifest, isEnvModalOpen, setIsEnvModalOpen, saveEnv } = useGraphStore();

  const envNode = manifest?.nodes.find((n) => n.id === "env-config");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (envNode?.envKeys) {
      const initial: Record<string, string> = {};
      envNode.envKeys.forEach((k) => {
        initial[k.key] = k.currentValue || k.defaultValue || "";
      });
      setEntries(initial);
    }
  }, [envNode]);

  if (!isEnvModalOpen) return null;

  const handleSave = () => {
    saveEnv(entries);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsEnvModalOpen(false);
    }, 1200);
  };

  const envKeys = envNode?.envKeys || [];
  const missingCount = envKeys.filter((e) => !entries[e.key]).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">
                Environment Variables (.env)
              </h2>
              <p className="text-xs text-gray-400">
                {missingCount > 0 ? (
                  <span className="text-amber-400 font-medium">
                    {missingCount} required variable{missingCount > 1 ? "s" : ""} missing
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    All detected variables configured
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEnvModalOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm">
          {envKeys.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">
              No environment variable template (.env.example) detected in this project.
            </p>
          ) : (
            envKeys.map((item) => {
              const isSensitive =
                item.key.toLowerCase().includes("secret") ||
                item.key.toLowerCase().includes("key") ||
                item.key.toLowerCase().includes("password") ||
                item.key.toLowerCase().includes("token");

              const isVisible = showValues[item.key] ?? !isSensitive;

              return (
                <div
                  key={item.key}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 focus-within:border-indigo-500/80 transition"
                >
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-xs font-semibold text-indigo-300">
                      {item.key}
                    </label>
                    {item.description && (
                      <span className="text-[11px] text-gray-400 truncate max-w-xs">
                        {item.description}
                      </span>
                    )}
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type={isVisible ? "text" : "password"}
                      value={entries[item.key] || ""}
                      onChange={(e) =>
                        setEntries({ ...entries, [item.key]: e.target.value })
                      }
                      placeholder={item.defaultValue ? `Default: ${item.defaultValue}` : "Enter value..."}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-gray-100 pr-10 focus:outline-none focus:border-indigo-500 transition"
                    />
                    {isSensitive && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowValues({
                            ...showValues,
                            [item.key]: !isVisible,
                          })
                        }
                        className="absolute right-2.5 text-gray-500 hover:text-gray-300 transition"
                      >
                        {isVisible ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Writes directly to <code className="text-indigo-300 font-mono">.env</code> in workspace root.
          </span>
          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </span>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
            >
              <Save className="w-4 h-4" /> Save .env File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
