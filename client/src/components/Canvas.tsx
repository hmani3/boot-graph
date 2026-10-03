import React, { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
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
import { Maximize2, RotateCcw } from "lucide-react";

import { useGraphStore } from "../store/useGraphStore";
import { CustomNode } from "./CustomNode";
import { SetupNode, LifecycleTier } from "../types";

const nodeTypes = {
  customNode: CustomNode,
};

function computeDeterministicLayout(rawNodes: SetupNode[]): Node<{ node: SetupNode }>[] {
  const result: Node<{ node: SetupNode }>[] = [];

  const appRuntimes: SetupNode[] = [];
  const infraRuntimes: SetupNode[] = [];
  const envNodes: SetupNode[] = [];
  const packageNodes: SetupNode[] = [];
  const infraServices: SetupNode[] = [];
  const migrationNodes: SetupNode[] = [];
  const generateNodes: SetupNode[] = [];
  const seedNodes: SetupNode[] = [];
  const launchNodes: SetupNode[] = [];
  const otherNodes: SetupNode[] = [];

  for (const node of rawNodes) {
    const isInfra =
      node.id.includes("docker") ||
      node.id.includes("compose") ||
      node.id.includes("container") ||
      node.category === "service" ||
      (node.provides || []).some((p) => p.includes("docker") || p.startsWith("service:")) ||
      Boolean(node.command?.includes("docker"));

    if (node.tier === 1 || node.category === "runtime") {
      if (isInfra) {
        infraRuntimes.push(node);
      } else {
        appRuntimes.push(node);
      }
    } else if (node.tier === 3 || node.category === "env" || node.id.includes("env")) {
      envNodes.push(node);
    } else if (
      node.tier === 2 ||
      node.category === "package" ||
      node.id.includes("install") ||
      node.id.includes("deps")
    ) {
      packageNodes.push(node);
    } else if (node.tier === 4 || node.category === "service" || isInfra) {
      infraServices.push(node);
    } else if (node.tier === 5 || node.category === "db") {
      if (
        node.id.includes("generate") ||
        node.id.includes("client") ||
        (node.provides || []).some((p) => p.includes("client"))
      ) {
        generateNodes.push(node);
      } else {
        migrationNodes.push(node);
      }
    } else if (node.tier === 6 || node.category === "seed" || node.id.includes("seed")) {
      seedNodes.push(node);
    } else if (
      node.tier === 7 ||
      node.category === "app" ||
      node.id.includes("launch") ||
      node.id.includes("dev") ||
      node.id.includes("start")
    ) {
      launchNodes.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  const hasInfraServices = infraServices.length > 0 || infraRuntimes.length > 0;

  const VERTICAL_STEP = 370;

  // Col 0: Runtimes
  const xRuntime = 60;
  appRuntimes.forEach((node, idx) => {
    const y = 220 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xRuntime, y },
      data: { node: { ...node, position: { x: xRuntime, y } } },
    });
  });
  const infraRuntimeStartY = Math.max(770, 220 + appRuntimes.length * VERTICAL_STEP);
  infraRuntimes.forEach((node, idx) => {
    const y = infraRuntimeStartY + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xRuntime, y },
      data: { node: { ...node, position: { x: xRuntime, y } } },
    });
  });

  // Col 1: Setup Phase (Environment, Packages, Containers)
  const xEnv = hasInfraServices ? 580 : 560;
  const xDeps = 540;
  const xInfraService = 680;

  envNodes.forEach((node, idx) => {
    const y = 30 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xEnv, y },
      data: { node: { ...node, position: { x: xEnv, y } } },
    });
  });
  const packageStartY = Math.max(400, 30 + envNodes.length * VERTICAL_STEP);
  packageNodes.forEach((node, idx) => {
    const y = packageStartY + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xDeps, y },
      data: { node: { ...node, position: { x: xDeps, y } } },
    });
  });
  const infraServiceStartY = Math.max(
    770,
    packageStartY + packageNodes.length * VERTICAL_STEP
  );
  infraServices.forEach((node, idx) => {
    const y = infraServiceStartY + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xInfraService, y },
      data: { node: { ...node, position: { x: xInfraService, y } } },
    });
  });

  // Col 2: Schema & Migrations / Build (Tier 5)
  const xDatabase = hasInfraServices ? 1220 : 1100;
  migrationNodes.forEach((node, idx) => {
    const y = 220 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xDatabase, y },
      data: { node: { ...node, position: { x: xDatabase, y } } },
    });
  });
  const generateStartY = Math.max(
    590,
    220 + migrationNodes.length * VERTICAL_STEP
  );
  generateNodes.forEach((node, idx) => {
    const y = generateStartY + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xDatabase, y },
      data: { node: { ...node, position: { x: xDatabase, y } } },
    });
  });

  // Col 3: Data Seeding (Tier 6)
  const hasTier5 = migrationNodes.length > 0 || generateNodes.length > 0;
  const xSeed = (hasTier5 ? xDatabase : (hasInfraServices ? 1220 : 1100)) + 500;
  seedNodes.forEach((node, idx) => {
    const y = 220 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xSeed, y },
      data: { node: { ...node, position: { x: xSeed, y } } },
    });
  });

  // Col 4: Application Launch (Tier 7)
  const hasTier6 = seedNodes.length > 0;
  const xLaunch =
    (hasTier6 ? xSeed : (hasTier5 ? xDatabase : (hasInfraServices ? 1220 : 1100))) + 500;
  launchNodes.forEach((node, idx) => {
    const y = 220 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x: xLaunch, y },
      data: { node: { ...node, position: { x: xLaunch, y } } },
    });
  });

  otherNodes.forEach((node, idx) => {
    const x = xLaunch + 500;
    const y = 220 + idx * VERTICAL_STEP;
    result.push({
      id: node.id,
      type: "customNode",
      position: { x, y },
      data: { node: { ...node, position: { x, y } } },
    });
  });

  return result;
}

const CanvasInner: React.FC = () => {
  const {
    manifest,
    connectNodes,
    disconnectNodes,
    updateNode,
    resetLayout,
    activeTerminalNodeId,
  } = useGraphStore();
  const { fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<{ node: SetupNode }>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isInitialized = useRef(false);

  // Adjust camera position dynamically when the terminal drawer opens or closes
  useEffect(() => {
    if (isInitialized.current) {
      if (activeTerminalNodeId) {
        fitView({
          padding: { top: "30px", bottom: "380px", left: "40px", right: "40px" },
          duration: 350,
        });
      } else {
        fitView({ padding: 0.04, duration: 350 });
      }
    }
  }, [activeTerminalNodeId, fitView]);

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
      setTimeout(() => fitView({ padding: 0.04, duration: 400 }), 50);
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
      if (activeTerminalNodeId) {
        fitView({
          padding: { top: "30px", bottom: "380px", left: "40px", right: "40px" },
          duration: 400,
        });
      } else {
        fitView({ padding: 0.04, duration: 400 });
      }
    }, 40);
  }, [manifest, setNodes, resetLayout, fitView, activeTerminalNodeId]);

  const handleFitView = useCallback(() => {
    if (activeTerminalNodeId) {
      fitView({
        padding: { top: "30px", bottom: "380px", left: "40px", right: "40px" },
        duration: 400,
      });
    } else {
      fitView({ padding: 0.04, duration: 400 });
    }
  }, [fitView, activeTerminalNodeId]);

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-[#090d16]">
      {/* Canvas Navigation Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl">
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
          title="Auto-arrange all nodes into stage columns"
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
        fitViewOptions={{ padding: 0.04 }}
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
