---
name: Main tab and builder visibility
description: Why the globally mounted Blockly builder needs an additional route guard during main-tab navigation.
---

The Bot Builder stays mounted for the running bot engine, but its visual layer must be considered active only when both the dashboard tab state and the main URL hash identify Bot Builder.

**Why:** The shared tabs component and the dashboard store update on separate render/effect cycles. During hash-driven navigation they can temporarily disagree, allowing the globally mounted toolbox to paint over another tab even when that tab is visibly selected.

**How to apply:** Preserve the mounted Blockly host, but gate its active visual class and interaction state with the current `#bot_builder` route as well as `DBOT_TABS.BOT_BUILDER`. Keep inactive controls hidden and non-interactive.