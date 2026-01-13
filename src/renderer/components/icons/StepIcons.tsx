import {
  Brain,
  Wrench,
  Package,
  Bot,
  MessageSquare,
  Zap,
  type LucideIcon
} from 'lucide-react';
import type { SemanticStep } from '../../types/data';

/**
 * Maps semantic step types to their corresponding Lucide icons
 */
export const STEP_ICONS: Record<SemanticStep['type'], LucideIcon> = {
  thinking: Brain,
  tool_call: Wrench,
  tool_result: Package,
  subagent: Bot,
  output: MessageSquare,
  interruption: Zap,
};

/**
 * Simplified SVG path strings for each step type icon
 * Used for waterfall chart rendering where we need raw SVG paths
 */
export const STEP_ICON_PATHS: Record<SemanticStep['type'], string> = {
  // Brain - simplified brain shape
  thinking: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z',

  // Wrench - simplified wrench shape
  tool_call: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',

  // Package - simplified box shape
  tool_result: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.3 7l8.7 5 8.7-5 M12 22V12',

  // Bot - simplified robot shape
  subagent: 'M12 8V4 M8 8a4 4 0 0 1 8 0 M6 15v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3 M6 15h12 M9 18h.01 M15 18h.01',

  // MessageSquare - simplified message bubble
  output: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',

  // Zap - simplified lightning bolt
  interruption: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
};

/**
 * Color palette for semantic step types
 * Using exact hex colors for consistent rendering across components
 */
export const STEP_COLORS: Record<SemanticStep['type'], string> = {
  thinking: '#a78bfa',      // Purple
  tool_call: '#f59e0b',     // Amber
  tool_result: '#10b981',   // Green
  subagent: '#3b82f6',      // Blue
  output: '#8b5cf6',        // Purple (darker)
  interruption: '#ef4444',  // Red
};
