---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

### One Question at a Time (STRICT RULE)
Always ask **exactly ONE question per turn**. Never batch, list, or bundle multiple questions together.

1. **Pick the highest-leverage decision**: Identify the open frontier of decisions whose prerequisites are settled, and choose the single most foundational question to ask first.
2. **Always Use the Interactive `ask_question` Tool**:
   - Deliver the question by invoking the native `ask_question` tool. This launches the interactive keyboard-driven modal with Up (↑) and Down (↓) arrow-key navigation.
   - List distinct, user-directed response options.
   - Always list your recommended option first and prefix it with `(Recommended)`.
   - Do NOT print questions as plain markdown chat text; calling `ask_question` is mandatory.
3. **STOP and WAIT**: Immediately end your turn. Do NOT ask a second question, do NOT provide follow-up questions in the same message, and do NOT speculate on downstream choices until the user has answered this specific question.

### Adaptive Progression
Once the user answers that single question, that decision is settled:
1. It immediately reshapes the design tree and unblocks downstream decisions.
2. Re-evaluate the new frontier and ask the **next single question** using `ask_question`.
3. Never rush ahead to implementation or ask multiple downstream questions in advance.

Finding _facts_ is your job, never the user's. When a question needs a fact from the environment (filesystem, code, tools, etc.), search or dispatch a sub-agent to find it first; don't ask the user for anything you can discover yourself.

The session is done when the frontier is empty: every branch of the design tree is visited, and nothing is left silently assumed. Do not act on implementation until the user confirms you have reached a shared understanding.
