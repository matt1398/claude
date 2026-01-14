/**
 * GreetingBanner - Displays a time-based greeting on the dashboard.
 * Uses the greeting utility to show "Good Morning", "Good Afternoon", or "Good Evening".
 */

import { getGreeting } from '../../utils/greeting';

export function GreetingBanner() {
  const greeting = getGreeting();

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold text-claude-dark-text">
        {greeting}
      </h1>
      <p className="mt-2 text-claude-dark-text-secondary">
        What would you like to explore today?
      </p>
    </div>
  );
}
