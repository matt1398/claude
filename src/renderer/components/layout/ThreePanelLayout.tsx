import React from 'react';
import { ProjectsList } from '../projects/ProjectsList';
import { SessionsList } from '../sessions/SessionsList';
import { MiddlePanel } from './MiddlePanel';
import { RightPanel } from './RightPanel';

export const ThreePanelLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Left Panel - Projects + Sessions (280px) */}
      <div className="w-[280px] border-r border-gray-800 flex flex-col bg-gray-900/50 flex-shrink-0">
        <div className="flex-shrink-0 px-4 py-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-gray-100">
            Claude Code Visualizer
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Session execution timeline
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProjectsList />
          </div>

          <div className="flex-1 border-t border-gray-800 min-h-0 overflow-hidden">
            <SessionsList />
          </div>
        </div>
      </div>

      {/* Middle Panel - Chat History (flexible) */}
      <div className="flex-1 overflow-hidden min-w-0">
        <MiddlePanel />
      </div>

      {/* Right Panel - Gantt Chart (400px) */}
      <div className="w-[400px] overflow-hidden flex-shrink-0">
        <RightPanel />
      </div>
    </div>
  );
};
