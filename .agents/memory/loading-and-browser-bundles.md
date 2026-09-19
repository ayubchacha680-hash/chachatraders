---
name: Loading and browser bundles
description: Constraints for in-app lazy loading and browser-safe toolbox rendering.
---

Full-screen branded loaders are disabled across this app, including initial boot, lazy tab transitions, and Blockly initialization.

**Why:** Analysis, MultiScanner, Free Bots, and Bot Builder need to remain usable while their content initializes; route-level fallback overlays made the workspace appear blocked.

**How to apply:** Keep startup and in-app chunk fallbacks non-blocking; do not reintroduce a full-screen loader for any workspace state.

Blockly bootstrap can overlap independent IndexedDB workspace retrieval with the dynamic Blockly/block import.

**Why:** The Bot Builder's first usable render otherwise waits for these operations serially, making the tab appear slower than necessary.

**How to apply:** Start `getSavedWorkspaces()` before awaiting `loadBlockly()`, then await the saved-workspace result before injecting the workspace. Keep the loading state scoped to the Bot Builder pane.

The browser bundle should not rely on the default `react-dom/server` import for toolbox XML generation.

**Why:** The current Rsbuild browser resolution can produce an undefined module factory for that server renderer and trigger an invalid-hook cascade.

**How to apply:** Keep toolbox markup generation browser-safe and local unless the bundler configuration is deliberately changed and verified.