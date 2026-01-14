/**
 * Time-based greeting utility for the dashboard.
 * Provides a welcoming message based on the time of day.
 */

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';

/**
 * Get the current time of day category.
 * - Morning: 5:00 AM to 11:59 AM
 * - Afternoon: 12:00 PM to 4:59 PM
 * - Evening: 5:00 PM to 4:59 AM
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * Get a time-appropriate greeting string.
 * @returns "Good Morning", "Good Afternoon", or "Good Evening"
 */
export function getGreeting(): string {
  return `Good ${getTimeOfDay()}`;
}
