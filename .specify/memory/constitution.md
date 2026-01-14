<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: N/A → 1.0.0 (initial ratification)

  Added Principles:
    - I. Code Quality First
    - II. Testing Standards
    - III. User Experience Consistency
    - IV. Performance Requirements

  Added Sections:
    - Quality Gates (Section 2)
    - Development Workflow (Section 3)
    - Governance

  Removed Sections: None (initial version)

  Templates Requiring Updates:
    ✅ plan-template.md - Constitution Check section already supports dynamic gates
    ✅ spec-template.md - Success Criteria section aligns with performance/UX principles
    ✅ tasks-template.md - Test task patterns align with Testing Standards principle

  Deferred Items: None
-->

# Claude Code Execution Visualizer Constitution

## Core Principles

### I. Code Quality First

All code MUST adhere to TypeScript strict mode with zero type errors. Every module MUST be
self-contained with explicit dependencies and clear interfaces. Functions MUST have single
responsibilities and be independently testable.

**Non-Negotiable Rules:**
- TypeScript `strict: true` enforced across all tsconfig files
- No `any` types except with documented justification
- All public interfaces MUST have explicit type annotations
- Imports MUST be organized: external dependencies, then internal modules, then types
- Dead code MUST be removed immediately, not commented out
- Each service class MUST have a single responsibility
- Circular dependencies are prohibited

**Rationale:** An Electron app with complex data parsing requires strict typing to prevent
runtime errors that are difficult to debug across process boundaries. Type safety at compile
time catches errors before they reach users.

### II. Testing Standards

Critical data processing logic MUST have comprehensive test coverage. Tests MUST validate
behavior, not implementation details. Integration tests MUST verify cross-process
communication (main ↔ renderer via IPC).

**Non-Negotiable Rules:**
- ChunkBuilder, SessionParser, and SubagentResolver MUST maintain test suites
- Tests MUST run via `npm run test:chunks` and pass before merge
- Test files MUST be co-located or in parallel `tests/` structure
- Mocking MUST be limited to external dependencies (filesystem, network)
- Tests MUST verify message type guards behave correctly for edge cases
- IPC handlers MUST have contract tests validating request/response shapes

**Rationale:** The JSONL parsing layer is the foundation of visualization accuracy. A single
bug in chunk building or message classification cascades into incorrect UI display. Tests
serve as executable documentation of expected behavior.

### III. User Experience Consistency

UI components MUST follow established patterns and the Claude dark theme. Loading states,
error states, and empty states MUST be handled consistently across all views. User-facing
text MUST be clear and actionable.

**Non-Negotiable Rules:**
- All components MUST use Tailwind utility classes with `claude-dark-*` color tokens
- Loading states MUST show progress indication within 100ms of operation start
- Error messages MUST include actionable guidance (what went wrong, what to do)
- Empty states MUST guide users toward productive actions
- Component spacing MUST follow 4px/8px grid system
- Interactive elements MUST have visible focus states for keyboard navigation
- State transitions MUST be smooth (no jarring content shifts)

**Rationale:** A visualization tool's value is undermined if users cannot trust or understand
what they see. Consistent UX patterns reduce cognitive load and build confidence in the
displayed data.

### IV. Performance Requirements

The application MUST remain responsive when handling large session files. Operations MUST
complete within defined latency budgets. Memory usage MUST be bounded regardless of
session size.

**Non-Negotiable Rules:**
- Session file parsing MUST use streaming (line-by-line) processing
- LRU cache MUST limit memory to 50 entries with 10-minute TTL
- Initial project list MUST render within 500ms of app launch
- Session detail load MUST complete within 2 seconds for files under 10MB
- Virtual scrolling MUST be used for lists exceeding 100 items
- File watchers MUST debounce events with 100ms minimum delay
- D3.js chart rendering MUST not block the main thread for more than 16ms

**Rationale:** Claude sessions can grow to thousands of messages. Without performance
discipline, the visualization tool becomes unusable for the exact power users who need
it most.

## Quality Gates

This section defines mandatory checkpoints that MUST pass before code changes are accepted.

**Pre-Commit Gates:**
- `npm run typecheck` MUST pass with zero errors
- `npm run test:chunks` MUST pass with zero failures
- No ESLint errors (warnings permitted with documented justification)

**Pre-Merge Gates:**
- Manual verification that UI changes follow UX consistency rules
- Performance spot-check for changes touching parsing or rendering logic
- Cross-process smoke test (verify main ↔ renderer communication works)

**Release Gates:**
- Full test suite passes
- Application launches without errors on target platform
- Memory usage stable after 10 minutes of typical use

## Development Workflow

This section defines how code changes flow from development to production.

**Branch Strategy:**
- Feature branches MUST follow pattern: `feature/{short-description}`
- Bug fixes MUST follow pattern: `fix/{issue-description}`
- All changes MUST target `main` branch via pull request

**Code Review Requirements:**
- Changes to core services (ChunkBuilder, SessionParser, SubagentResolver) require
  verification that existing tests still pass
- UI changes MUST include screenshot or screen recording in PR description
- Performance-sensitive changes MUST include before/after metrics

**Commit Standards:**
- Commits MUST be atomic (one logical change per commit)
- Commit messages MUST follow conventional commits format
- Co-authored commits with AI assistance MUST include AI attribution

## Governance

This constitution supersedes all other development practices for the Claude Code Execution
Visualizer project. All contributors MUST comply with these principles.

**Amendment Process:**
1. Propose amendment via documented discussion
2. Demonstrate necessity with concrete examples of current limitations
3. Update constitution with version increment
4. Update dependent templates if amendment changes requirements
5. Communicate changes to all contributors

**Versioning Policy:**
- MAJOR: Removes or fundamentally redefines a principle
- MINOR: Adds new principle or materially expands existing guidance
- PATCH: Clarifications, wording improvements, non-semantic changes

**Compliance Review:**
- All pull requests MUST be checked against applicable principles
- Constitution violations MUST be resolved before merge
- Justified exceptions MUST be documented in code comments with rationale

**Version**: 1.0.0 | **Ratified**: 2026-01-14 | **Last Amended**: 2026-01-14
