import React from 'react';
import { ProjectsList } from '../projects/ProjectsList';
import { SessionsList } from '../sessions/SessionsList';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';

export const ThreePanelLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Left Sidebar - Projects + Sessions (280px) */}
      <div className="w-[280px] flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-zinc-100">Claude Visualizer</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Session Explorer</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProjectsList />
          </div>

          <div className="flex-1 border-t border-zinc-800 min-h-0 overflow-hidden">
            <SessionsList />
          </div>
        </div>
      </div>

      {/* Middle Panel - Chat History (flexible) */}
      <div className="flex-1 flex flex-col bg-zinc-900 border-r border-zinc-800 overflow-hidden min-w-0">
        <MiddlePanel />
      </div>

      {/* Right Panel - Gantt Chart (400px) */}
      <div className="w-[400px] flex-shrink-0 bg-zinc-950 flex flex-col overflow-hidden">
        <RightPanel />
      </div>
    </div>
  );
};
