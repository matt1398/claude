import React from 'react';
import { ChatHistory } from '../chat/ChatHistory';
import { useStore } from '../../store';

export const MiddlePanel: React.FC = () => {
  const drillDownSubagent = useStore((state) => state.drillDownSubagent);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectedSessionId = useStore((state) => state.selectedSessionId);

  const handleSubagentClick = (subagentId: string, description: string) => {
    if (selectedProjectId && selectedSessionId) {
      drillDownSubagent(selectedProjectId, selectedSessionId, subagentId, description);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHistory onSubagentClick={handleSubagentClick} />
    </div>
  );
};
