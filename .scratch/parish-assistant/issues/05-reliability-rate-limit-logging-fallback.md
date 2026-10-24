# 05: Reliability: server rate limit, one log per exchange, model list, fallback

Type: task
**Status:** ready-for-agent
**Blocked by:** 03

**What to build:** the assistant stays usable and protects the free Gemini quota.

- At most 10 assistant messages per user per 5 minutes, enforced in `parish-assistant` by counting that user's recent chat logs; over the limit it returns the existing friendly rate-limit notice. The browser limiter stays only as a hint in the UI.
- Each exchange is logged once, by the server, in the chat logs (with the parish when there is one). The browser stops writing its own copy for assistant chats.
- Models are tried in the order given by the environment variable, falling back to the next on quota or overload errors. The deprecated 2.0 models are not in the default list. Confirm the default list with Tyrone before any real call.
- If the function errors or times out, plain questions fall back to the existing keyword answers in the browser, and the Parishioner always gets the parish contact as a last resort.

- [ ] The 11th message inside 5 minutes gets the rate-limit notice from the server, even with browser storage cleared
- [ ] One chat log row per exchange, none written by the browser for assistant chats
- [ ] With the function unreachable, asking for Mass times still returns the keyword fallback answer
- [ ] A quota error from the fake Gemini on the first model falls through to the next model
- [ ] `tsc -b` and lint are clean
