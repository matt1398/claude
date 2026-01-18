import { useEffect } from 'react';
import { TabbedLayout } from './components/layout/TabbedLayout';
import { useTheme } from './hooks/useTheme';
import { initializeNotificationListeners } from './store';

function App() {
  // Initialize theme on app load
  useTheme();

  // Initialize IPC event listeners (notifications, file changes)
  useEffect(() => {
    const cleanup = initializeNotificationListeners();
    return cleanup;
  }, []);

  return <TabbedLayout />;
}

export default App;
