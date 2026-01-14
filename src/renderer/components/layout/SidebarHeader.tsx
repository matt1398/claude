/**
 * SidebarHeader - Top section of sidebar with drag region and project dropdown.
 * Handles macOS traffic light spacing and window dragging.
 */

import { ProjectDropdown } from '../sidebar/ProjectDropdown';

export function SidebarHeader() {
  return (
    <div
      className="h-[52px] flex items-center border-b border-claude-dark-border sidebar-header"
      style={{
        paddingLeft: '90px', // Reserve space for macOS traffic lights
        paddingRight: '12px',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <ProjectDropdown />
    </div>
  );
}
