---
name: Blockly startup ordering
description: Why the DBot workspace must retry initialization after its host and API-backed engine stores become available.
---

Blockly workspace initialization must not assume the React host element and API-backed DBot stores are available in a fixed order. If the initial mount runs before the stores are injected, initialization must be retriggered after store setup; if the stores arrive first, initialization must wait for the host element.

**Why:** Returning early from either race leaves the Blockly initialization promise unresolved and produces a permanently blank Bot Builder without a useful browser error.

**How to apply:** Any changes to app startup, auth loading, or Bot Builder mounting must preserve both readiness checks and ensure only one workspace initialization runs at a time.