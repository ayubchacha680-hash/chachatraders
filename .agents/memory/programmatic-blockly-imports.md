---
name: Programmatic Blockly imports
description: How built-in strategy catalogues should load generated XML into the live Bot Builder.
---

Built-in/generated strategy XML should pass through backward-compatibility conversion, validate every resulting block type against the live Blockly registry, and use the asynchronous workspace loader.

**Why:** The full user-file import routine also updates file history and modal state. When called directly from an in-app bot catalogue, those unrelated side effects can fail after the blocks have loaded and incorrectly report valid XML as unsupported.

**How to apply:** Reserve the complete import routine for uploaded/saved files. For generated catalogue XML, run conversion and registry validation, then replace the live workspace asynchronously and reset the Blockly event group.