import { ProjectsList } from './components/projects/ProjectsList';
import { SessionsList } from './components/sessions/SessionsList';
import { SessionDetail } from './components/detail/SessionDetail';

function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col bg-gray-900/50">
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

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-gray-950">
        <SessionDetail />
      </div>
    </div>
  );
}

export default App;
