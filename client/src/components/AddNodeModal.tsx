import React, { useState } from "react";
import { X, Plus, Layers } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { LifecycleTier, LIFECYCLE_TIER_NAMES, SetupNode } from "../types";

export const AddNodeModal: React.FC = () => {
  const { isAddModalOpen, setIsAddModalOpen, addNode, manifest } = useGraphStore();

  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [tier, setTier] = useState<LifecycleTier>(5);
  const [description, setDescription] = useState("");
  const [prereqId, setPrereqId] = useState("");

  if (!isAddModalOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const id = `custom-${Date.now()}`;
    const newNode: SetupNode = {
      id,
      name,
      tier,
      category: "custom",
      status: "blocked",
      command,
      description: description || "Custom developer setup step.",
      docLinks: [],
      provides: [`custom:${id}`],
      requires: prereqId ? [prereqId] : [],
    };

    addNode(newNode);
    setIsAddModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-gray-100">
              Add Custom Setup Step
            </h2>
          </div>
          <button
            onClick={() => setIsAddModalOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4 text-xs">
          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Step Name:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Seed Superadmin Account"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Command to Execute:
            </label>
            <input
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. node scripts/seed-admin.js"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Lifecycle Tier:
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(parseInt(e.target.value, 10) as LifecycleTier)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 transition"
              >
                {([1, 2, 3, 4, 5, 6, 7] as LifecycleTier[]).map((t) => (
                  <option key={t} value={t}>
                    Tier {t}: {LIFECYCLE_TIER_NAMES[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Prerequisite Step (Blocked By):
              </label>
              <select
                value={prereqId}
                onChange={(e) => setPrereqId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">None (Runs immediately in Tier)</option>
                {manifest?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Description / Notes:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explains what this step accomplishes..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-2 rounded-lg text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition shadow"
            >
              Add Step
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
