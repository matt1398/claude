# Clearing Electron Cache

If you're experiencing runtime errors that don't appear in the source code (like `dragEvent is not defined`), the Electron app may be serving cached JavaScript bundles.

## How to Clear Cache

### Option 1: Delete cache directories
```bash
# Clear Electron cache
rm -rf ~/Library/Application\ Support/claude-viz
rm -rf ~/Library/Caches/claude-viz

# Clear build output
rm -rf out/
rm -rf dist-electron/

# Rebuild
npm run build
```

### Option 2: Hard reload in dev mode
1. Open the Electron app
2. Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux) for a hard reload
3. Or open DevTools (`Cmd+Option+I`) and right-click the reload button, select "Empty Cache and Hard Reload"

### Option 3: Clear via code
The Electron main process can clear cache programmatically:
```javascript
// In main process
const { session } = require('electron');
session.defaultSession.clearCache();
```

## Prevention

To prevent cache issues during development:
- Use `npm run dev` instead of `npm run preview` for hot module reloading
- Always rebuild after pulling code changes: `npm run build`
- Check that TypeScript compiles without errors: `npm run typecheck`
