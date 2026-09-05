---
name: Loading and browser bundles
description: Constraints for in-app lazy loading and browser-safe toolbox rendering.
---

Full-screen branded loaders are appropriate for initial app boot, but not for lazy tab transitions or Blockly initialization because they cover the trading workspace while the user is running or inspecting the bot.

**Why:** Analysis, MultiScanner, Free Bots, and Bot Builder need to remain usable while their content initializes; route-level fallback overlays made the workspace appear blocked.

**How to apply:** Use a non-blocking fallback for in-app tab chunks and avoid reintroducing a full-screen loader for Blockly initialization.

The browser bundle should not rely on the default `react-dom/server` import for toolbox XML generation.

**Why:** The current Rsbuild browser resolution can produce an undefined module factory for that server renderer and trigger an invalid-hook cascade.

**How to apply:** Keep toolbox markup generation browser-safe and local unless the bundler configuration is deliberately changed and verified.