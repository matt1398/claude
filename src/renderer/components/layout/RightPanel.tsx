import React from 'react';
import { GanttPanel } from '../gantt/GanttPanel';

export const RightPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <GanttPanel />
    </div>
  );
};
