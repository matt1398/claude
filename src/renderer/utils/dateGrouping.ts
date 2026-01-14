/**
 * Date-based session grouping utility.
 * Groups sessions by relative date categories: Today, Yesterday, Previous 7 Days, Older.
 */

import { isToday, isYesterday, differenceInDays } from 'date-fns';
import type { Session } from '../types/data';
import type { DateGroupedSessions, DateCategory } from '../types/tabs';
import { DATE_CATEGORY_ORDER } from '../types/tabs';

/**
 * Groups sessions by relative date category.
 * Sessions are categorized based on their createdAt timestamp:
 * - Today: Sessions created today
 * - Yesterday: Sessions created yesterday
 * - Previous 7 Days: Sessions created 2-7 days ago
 * - Older: Sessions created more than 7 days ago
 *
 * Within each category, sessions maintain their original sort order.
 *
 * @param sessions Array of sessions to group
 * @returns Object with sessions grouped by date category
 */
export function groupSessionsByDate(sessions: Session[]): DateGroupedSessions {
  const now = new Date();

  return sessions.reduce<DateGroupedSessions>(
    (acc, session) => {
      const sessionDate = new Date(session.createdAt);

      if (isToday(sessionDate)) {
        acc['Today'].push(session);
      } else if (isYesterday(sessionDate)) {
        acc['Yesterday'].push(session);
      } else if (differenceInDays(now, sessionDate) <= 7) {
        acc['Previous 7 Days'].push(session);
      } else {
        acc['Older'].push(session);
      }

      return acc;
    },
    { 'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Older': [] }
  );
}

/**
 * Get non-empty date categories in display order.
 * Useful for rendering only categories that have sessions.
 *
 * @param grouped The grouped sessions object
 * @returns Array of non-empty category names in display order
 */
export function getNonEmptyCategories(grouped: DateGroupedSessions): DateCategory[] {
  return DATE_CATEGORY_ORDER.filter(category => grouped[category].length > 0);
}

/**
 * Get total count of sessions across all categories.
 *
 * @param grouped The grouped sessions object
 * @returns Total number of sessions
 */
export function getTotalSessionCount(grouped: DateGroupedSessions): number {
  return DATE_CATEGORY_ORDER.reduce(
    (total, category) => total + grouped[category].length,
    0
  );
}
