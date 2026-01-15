import React from 'react';
import { ChatHistory } from '../chat/ChatHistory';
import { SearchBar } from '../search/SearchBar';

export const MiddlePanel: React.FC = () => {
  return (
    <div className="relative flex flex-col h-full">
      <SearchBar />
      <ChatHistory />
    </div>
  );
};
