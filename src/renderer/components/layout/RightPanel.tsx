import React from 'react';
import { GanttPanel } from '../gantt/GanttPanel';

export const RightPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full border-l border-gray-800">
      <GanttPanel />
    </div>
  );
};
