# Claude Code Execution Visualizer

An Electron desktop application to visualize Claude Code session execution, showing execution flow, parallel operations, and resource usage through an interactive waterfall chart.

## Project Status

**Phase 1.1: Project Initialization - COMPLETE**

The project structure and build configuration has been initialized with:
- Electron-vite build system
- React 18.x + TypeScript 5.x
- Tailwind CSS for styling
- All necessary dependencies installed

## Technology Stack

### Core
- **Electron** 28.x - Desktop app framework
- **electron-vite** - Optimized bundler for Electron apps
- **React** 18.x + **TypeScript** 5.x - UI framework
- **Tailwind CSS** 3.x - Styling

### Data Visualization
- **D3.js** 7.x - Waterfall chart rendering

### State Management & Utilities
- **Zustand** 4.x - State management
- **lru-cache** - Cache parsed sessions
- **@tanstack/react-virtual** - Virtual scrolling for large lists
- **date-fns** - Date formatting

## Project Structure

```
claude-viz/
├── package.json
├── electron.vite.config.ts      # Build configuration
├── tsconfig.json                 # TypeScript config (renderer)
├── tsconfig.node.json            # TypeScript config (main/preload)
├── tailwind.config.js            # Tailwind CSS config
├── postcss.config.js             # PostCSS config
├── src/
│   ├── main/                     # Main process (Node.js)
│   │   ├── index.ts              # Entry point, creates BrowserWindow
│   │   ├── ipc/
│   │   │   └── handlers.ts       # IPC API handlers (placeholder)
│   │   ├── services/             # TODO: Phase 1.3-1.6
│   │   │   ├── ProjectScanner.ts
│   │   │   ├── SessionParser.ts
│   │   │   ├── SubagentResolver.ts
│   │   │   ├── DataCache.ts
│   │   │   └── FileWatcher.ts
│   │   └── utils/
│   │       ├── pathDecoder.ts
│   │       └── jsonl.ts
│   ├── preload/
│   │   └── index.ts              # Secure IPC bridge
│   └── renderer/                 # Renderer process (React)
│       ├── index.html
│       ├── main.tsx              # React entry point
│       ├── index.css             # Global styles with Tailwind
│       ├── App.tsx               # Main app component
│       ├── types/
│       │   └── data.ts           # TypeScript interfaces
│       ├── store/                # TODO: Phase 2.2
│       │   └── index.ts
│       ├── components/           # TODO: Phase 2.3-2.5
│       │   ├── projects/
│       │   │   └── ProjectsList.tsx
│       │   ├── sessions/
│       │   │   └── SessionsList.tsx
│       │   └── detail/
│       │       ├── SessionDetail.tsx
│       │       ├── ChunkView.tsx
│       │       └── WaterfallChart.tsx
│       └── utils/                # TODO: Phase 3.2-3.3
│           ├── chartHelpers.ts
│           └── parallelDetection.ts
└── resources/                    # App icons, etc.
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start the development server with hot reload enabled.

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Next Steps

Follow the implementation plan from the project specification:

### Phase 1: Data Parsing Layer (Week 1)
- **1.2** Core Data Types ✓ (completed in 1.1)
- **1.3** ProjectScanner Service - Scan `~/.claude/projects/`
- **1.4** SessionParser Service - Parse JSONL session files
- **1.5** SubagentResolver Service - Link Tasks to subagents
- **1.6** DataCache - LRU caching
- **1.7** IPC Setup - Connect services to renderer

### Phase 2: UI Components (Week 2)
- **2.1** Layout Structure
- **2.2** Zustand Store
- **2.3** ProjectsList Component
- **2.4** SessionsList Component
- **2.5** SessionDetail Component

### Phase 3: Waterfall Chart (Week 3)
- **3.1** WaterfallChart Component with D3.js
- **3.2** Data Transformation
- **3.3** Parallel Detection

### Phase 4: Performance (Week 4)
- **4.1** Caching
- **4.2** Virtual Scrolling
- **4.3** Streaming Parsing
- **4.4** File Watching

### Phase 5: Polish
- **5.1** Error Handling
- **5.2** Loading States
- **5.3** Styling
- **5.4** Empty States

## Data Source

The application reads from `~/.claude/projects/` which contains:
- Project directories (encoded as `-Users-bskim-projectname`)
- Session files (`{uuid}.jsonl` format)
- Subagent files in `{sessionId}/subagents/agent-{hash}.jsonl`

## Configuration Files Created

- **package.json** - Dependencies and scripts
- **electron.vite.config.ts** - Build configuration for main/preload/renderer
- **tsconfig.json** - TypeScript for renderer
- **tsconfig.node.json** - TypeScript for main/preload
- **tailwind.config.js** - Tailwind with Claude dark theme colors
- **postcss.config.js** - PostCSS with Tailwind and Autoprefixer
- **.gitignore** - Standard Node/Electron ignores

## Development Notes

- Main process runs in Node.js environment
- Renderer process runs React in Chromium
- Preload script bridges the two securely via contextBridge
- IPC communication uses type-safe handlers
- Tailwind configured with Claude Code's dark theme colors
