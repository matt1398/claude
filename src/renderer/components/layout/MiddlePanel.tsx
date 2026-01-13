import React from 'react';
import { ChatHistory } from '../chat/ChatHistory';

export const MiddlePanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <ChatHistory />
    </div>
  );
};
