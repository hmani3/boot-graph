import React, { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Canvas } from "./components/Canvas";
import { TerminalDrawer } from "./components/TerminalDrawer";
import { InspectorModal } from "./components/InspectorModal";
import { EnvModal } from "./components/EnvModal";
import { AddNodeModal } from "./components/AddNodeModal";
import { useGraphStore } from "./store/useGraphStore";
import { Loader2 } from "lucide-react";

export const App: React.FC = () => {
  const { initWebSocket, manifest, connected } = useGraphStore();

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#090d16] text-gray-100 overflow-hidden font-sans">
      <TopBar />

      <main className="flex-1 relative overflow-hidden">
        {manifest ? (
          <Canvas />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">
              {connected
                ? "Scanning codebase and compiling dependency graph..."
                : "Connecting to local BootGraph daemon..."}
            </p>
          </div>
        )}
      </main>

      <TerminalDrawer />
      <InspectorModal />
      <EnvModal />
      <AddNodeModal />
    </div>
  );
};

export default App;
