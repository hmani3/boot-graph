import { create } from "zustand";
import { BootGraphManifest, SetupNode } from "../types";

interface GraphState {
  manifest: BootGraphManifest | null;
  connected: boolean;
  selectedNodeId: string | null;
  activeTerminalNodeId: string | null;
  isEnvModalOpen: boolean;
  isAddModalOpen: boolean;

  ws: WebSocket | null;

  initWebSocket: () => void;
  runNode: (nodeId: string, commandOverride?: string) => void;
  skipNode: (nodeId: string) => void;
  runAll: () => void;
  stopNode: (nodeId: string) => void;
  sendTerminalInput: (nodeId: string, data: string) => void;
  updateNode: (nodeId: string, updates: Partial<SetupNode>) => void;
  addNode: (node: SetupNode) => void;
  deleteNode: (nodeId: string) => void;
  connectNodes: (source: string, target: string) => void;
  disconnectNodes: (edgeId: string) => void;
  saveEnv: (entries: Record<string, string>) => void;
  saveConfig: () => void;
  resetLayout: () => void;
  rescan: () => void;

  setSelectedNodeId: (id: string | null) => void;
  setActiveTerminalNodeId: (id: string | null) => void;
  setIsEnvModalOpen: (open: boolean) => void;
  setIsAddModalOpen: (open: boolean) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  manifest: null,
  connected: false,
  selectedNodeId: null,
  activeTerminalNodeId: null,
  isEnvModalOpen: false,
  isAddModalOpen: false,
  ws: null,

  initWebSocket: () => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ connected: true, ws });
    };

    ws.onclose = () => {
      set({ connected: false });
      // Reconnect after 2s
      setTimeout(() => get().initWebSocket(), 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "GRAPH_INIT":
            set({ manifest: msg.manifest });
            break;

          case "GRAPH_UPDATED":
            set({ manifest: msg.manifest });
            break;

          case "NODE_STATUS_CHANGE": {
            const current = get().manifest;
            if (!current) break;
            const updated = current.nodes.map((n) =>
              n.id === msg.nodeId
                ? {
                    ...n,
                    status: msg.status,
                    durationMs: msg.durationMs ?? n.durationMs,
                    exitCode: msg.exitCode ?? n.exitCode,
                  }
                : n
            );
            set({ manifest: { ...current, nodes: updated } });
            break;
          }

          case "TERMINAL_OUTPUT": {
            const current = get().manifest;
            if (!current) break;
            const updated = current.nodes.map((n) =>
              n.id === msg.nodeId
                ? { ...n, output: (n.output || "") + msg.chunk }
                : n
            );
            set({ manifest: { ...current, nodes: updated } });
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };
  },

  runNode: (nodeId, commandOverride) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "RUN_NODE", nodeId, commandOverride }));
      set({ activeTerminalNodeId: nodeId });
    }
  },

  skipNode: (nodeId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "SKIP_NODE", nodeId }));
    }
  },

  runAll: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "RUN_ALL" }));
    }
  },

  stopNode: (nodeId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "STOP_NODE", nodeId }));
    }
  },

  sendTerminalInput: (nodeId, data) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "TERMINAL_INPUT", nodeId, data }));
    }
  },

  updateNode: (nodeId, updates) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "UPDATE_NODE", nodeId, updates }));
    }
  },

  addNode: (node) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ADD_NODE", node }));
    }
  },

  deleteNode: (nodeId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "DELETE_NODE", nodeId }));
      if (get().selectedNodeId === nodeId) set({ selectedNodeId: null });
    }
  },

  connectNodes: (source, target) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "CONNECT_NODES", source, target }));
    }
  },

  disconnectNodes: (edgeId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "DISCONNECT_NODES", edgeId }));
    }
  },

  saveEnv: (entries) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "SAVE_ENV", entries }));
    }
  },

  saveConfig: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "SAVE_CONFIG" }));
    }
  },

  resetLayout: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "RESET_LAYOUT" }));
    }
  },

  rescan: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "RESCAN" }));
    }
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveTerminalNodeId: (id) => set({ activeTerminalNodeId: id }),
  setIsEnvModalOpen: (open) => set({ isEnvModalOpen: open }),
  setIsAddModalOpen: (open) => set({ isAddModalOpen: open }),
}));
