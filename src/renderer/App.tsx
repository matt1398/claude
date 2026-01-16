import { TabbedLayout } from './components/layout/TabbedLayout';
import { useTheme } from './hooks/useTheme';

function App() {
  // Initialize theme on app load
  useTheme();

  return <TabbedLayout />;
}

export default App;
