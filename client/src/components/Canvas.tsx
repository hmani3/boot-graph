import React, { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

import { useGraphStore } from "../store/useGraphStore";
import { CustomNode } from "./CustomNode";
import { SetupNode, LifecycleTier, TIER_THEMES } from "../types";

const nodeTypes = {
  customNode: CustomNode,
};

const TIER_X_OFFSET: Record<LifecycleTier, number> = {
  1: 60,
  2: 620,
  3: 1180,
  4: 1740,
  5: 2300,
  6: 2860,
  7: 3420,
};

function computeDeterministicLayout(rawNodes: SetupNode[]): Node<{ node: SetupNode }>[] {
  const tierGroups: Record<number, SetupNode[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };

  for (const node of rawNodes) {
    const t = node.tier in tierGroups ? node.tier : 1;
    tierGroups[t].push(node);
  }

  const result: Node<{ node: SetupNode }>[] = [];

  for (let t = 1; t <= 7; t++) {
    const group = tierGroups[t] || [];
    const x = TIER_X_OFFSET[t as LifecycleTier] || 60;

    const appNodes: SetupNode[] = [];
    const infraNodes: SetupNode[] = [];
    const envNodes: SetupNode[] = [];

    for (const node of group) {
      const isInfra =
        node.category === "service" ||
        node.id.includes("docker") ||
        node.id.includes("compose") ||
        node.id.includes("container") ||
        node.id.includes("generate") ||
        node.provides?.some(
          (p) =>
            p.startsWith("service:") ||
            p.includes("docker") ||
            p.includes("client")
        ) ||
        Boolean(node.command?.includes("docker"));

      const isEnv =
        !isInfra &&
        (node.category === "env" || node.tier === 3 || node.id.includes("env"));

      if (isInfra) {
        infraNodes.push(node);
      } else if (isEnv) {
        envNodes.push(node);
      } else {
        appNodes.push(node);
      }
    }

    appNodes.forEach((node, idx) => {
      const y = 100 + idx * 280;
      result.push({
        id: node.id,
        type: "customNode",
        position: { x, y },
        data: { node: { ...node, position: { x, y } } },
      });
    });

    envNodes.forEach((node, idx) => {
      const y = -80 - idx * 280;
      result.push({
        id: node.id,
        type: "customNode",
        position: { x, y },
        data: { node: { ...node, position: { x, y } } },
      });
    });

    infraNodes.forEach((node, idx) => {
      const y = 480 + idx * 280;
      result.push({
        id: node.id,
        type: "customNode",
        position: { x, y },
        data: { node: { ...node, position: { x, y } } },
      });
    });
  }

  return result;
}

const CanvasInner: React.FC = () => {
  const { manifest, connectNodes, disconnectNodes, updateNode, resetLayout } =
    useGraphStore();
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<{ node: SetupNode }>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isInitialized = useRef(false);

  // Sync manifest nodes with React Flow state while preserving live drag positions
  useEffect(() => {
    if (!manifest) return;

    if (!isInitialized.current) {
      isInitialized.current = true;
      const initialNodes = computeDeterministicLayout(manifest.nodes);
      for (const n of initialNodes) {
        positionsRef.current.set(n.id, n.position);
      }
      setNodes(initialNodes);
      setTimeout(() => fitView({ padding: 0.08, duration: 400 }), 50);
    } else {
      setNodes((prevNodes) => {
        const livePosMap = new Map<string, { x: number; y: number }>();
        for (const n of prevNodes) {
          livePosMap.set(n.id, n.position);
        }

        return manifest.nodes.map((node) => {
          const position =
            livePosMap.get(node.id) ||
            positionsRef.current.get(node.id) ||
            node.position ||
            { x: 0, y: 0 };

          return {
            id: node.id,
            type: "customNode",
            position,
            data: { node: { ...node, position } },
          };
        });
      });
    }

    setEdges(
      manifest.edges.map((edge) => {
        const sourceNode = manifest.nodes.find((n) => n.id === edge.source);
        const isSkipped = sourceNode?.status === "skipped";
        const isCompleted = sourceNode?.status === "completed";
        const isFailed = sourceNode?.status === "failed";

        const strokeColor = isCompleted
          ? "#10b981"
          : isSkipped
          ? "#eab308"
          : isFailed
          ? "#f43f5e"
          : "#6366f1";

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          pathOptions: { borderRadius: 16, offset: 25 },
          animated: isCompleted || sourceNode?.status === "running",
          style: {
            stroke: strokeColor,
            strokeWidth: 2,
            strokeDasharray: isSkipped ? "6,4" : undefined,
            opacity: isSkipped ? 0.8 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 16,
            height: 16,
          },
        };
      })
    );
  }, [manifest, setNodes, setEdges, fitView]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      positionsRef.current.set(node.id, node.position);
      updateNode(node.id, { position: node.position });
    },
    [updateNode]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connectNodes(connection.source, connection.target);
      }
    },
    [connectNodes]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => disconnectNodes(e.id));
    },
    [disconnectNodes]
  );

  // Synchronous, instant layout arrangement
  const handleResetLayout = useCallback(() => {
    if (!manifest) return;
    positionsRef.current.clear();
    const layouted = computeDeterministicLayout(manifest.nodes);
    for (const n of layouted) {
      positionsRef.current.set(n.id, n.position);
    }
    setNodes(layouted);
    resetLayout();
    setTimeout(() => {
      fitView({ padding: 0.08, duration: 400 });
    }, 40);
  }, [manifest, setNodes, resetLayout, fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.08, duration: 400 });
  }, [fitView]);

  const jumpToStage = useCallback(
    (stage: LifecycleTier) => {
      const x = (TIER_X_OFFSET[stage] || 60) + 210;
      setCenter(x, 240, { duration: 450, zoom: 0.95 });
    },
    [setCenter]
  );

  const stagesInProject = manifest?.summary?.tiersPresent || [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-[#090d16]">
      {/* Horizontal Stage Pipeline Navigation Bar */}
      <div className="absolute top-4 left-6 z-20 hidden lg:flex items-center gap-1.5 p-1.5 bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-x-auto max-w-[calc(100vw-28rem)]">
        {([1, 2, 3, 4, 5, 6, 7] as LifecycleTier[]).map((tier, idx) => {
          const theme = TIER_THEMES[tier];
          const nodesInTier = manifest?.nodes.filter((n) => n.tier === tier) || [];
          const isPresent = nodesInTier.length > 0;
          const allCompleted =
            isPresent && nodesInTier.every((n) => n.status === "completed");
          const hasSkipped = isPresent && nodesInTier.some((n) => n.status === "skipped");

          return (
            <React.Fragment key={tier}>
              <button
                onClick={() => jumpToStage(tier)}
                disabled={!isPresent}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition select-none ${
                  !isPresent
                    ? "opacity-30 cursor-not-allowed text-gray-500"
                    : allCompleted
                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/50"
                    : hasSkipped
                    ? "bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/50"
                    : "bg-slate-900/80 text-gray-300 border border-slate-800 hover:border-slate-700 hover:text-white"
                }`}
                title={`Jump to Stage ${tier}: ${theme.name} (${nodesInTier.length} steps)`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.dotColor }}
                />
                <span className="font-semibold">{theme.stageLabel}</span>
                <span className="text-[11px] text-gray-400 truncate max-w-[100px]">
                  {theme.name}
                </span>
                {allCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              {idx < 6 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Floating Canvas Navigation Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl">
        <button
          onClick={() => zoomIn({ duration: 250 })}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOut({ duration: 250 })}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-800 my-auto" />
        <button
          onClick={handleFitView}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-800 transition"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetLayout}
          className="p-2 rounded-lg text-gray-200 hover:text-white bg-indigo-600/80 hover:bg-indigo-600 transition flex items-center gap-1.5 text-xs font-semibold px-3 rounded-lg shadow-sm"
          title="Instantly auto-arrange all nodes into non-overlapping stage columns"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Auto-Arrange</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.15}
        maxZoom={2.0}
        panOnDrag={[0, 1, 2]}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        nodesDraggable={true}
        edgesFocusable={true}
        edgesReconnectable={true}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#1e293b"
        />

        <MiniMap
          nodeColor={(n) => {
            const node = (n.data as any)?.node as SetupNode;
            switch (node?.status) {
              case "completed":
                return "#10b981";
              case "running":
                return "#0ea5e9";
              case "failed":
                return "#f43f5e";
              case "ready":
                return "#eab308";
              case "skipped":
                return "#64748b";
              default:
                return "#334155";
            }
          }}
          className="!bg-[#0f172a]/90 !border-slate-800 !rounded-xl overflow-hidden shadow-xl"
          maskColor="rgba(9, 13, 22, 0.75)"
        />
      </ReactFlow>
    </div>
  );
};

export const Canvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};
