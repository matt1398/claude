interface DebugSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedData: any;
  title: string;
}

export const DebugSidebar: React.FC<DebugSidebarProps> = ({
  isOpen, onClose, selectedData, title
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-medium text-gray-200">Debug: {title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
          ✕
        </button>
      </div>
      <div className="p-4 overflow-auto h-[calc(100%-56px)]">
        <pre className="text-xs text-gray-300 whitespace-pre-wrap">
          {JSON.stringify(selectedData, null, 2)}
        </pre>
      </div>
    </div>
  );
};
