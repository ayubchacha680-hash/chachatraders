---
name: Dynamic cycle purchases
description: Purchase-engine rule for strategies that change digit contract families and barriers at runtime.
---

Strategies that dynamically switch among Differ, Over/Under, and Even/Odd must take an immutable snapshot of the current trade options and use the guarded direct-buy path for each selected contract.

**Why:** Normal Purchase blocks can safely use proposal subscriptions because their contract family is fixed by the trade definition. A dynamic cycle cannot reuse those subscriptions: the proposal may belong to a different contract family or barrier. Parity contracts must also omit prediction/barrier entirely.

**How to apply:** Keep normal Purchase behavior unchanged. For dynamic cycle purchases, bypass subscribed proposals, preserve scope/duplicate-purchase guards, include the selected barrier for barrier contracts, and remove it for Even/Odd.