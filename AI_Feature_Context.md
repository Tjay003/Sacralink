# SACRALINK — AI Feature Context (Backend Implemented Reality)
> **Feature:** AI Parishioner Assistant (Chatbot / Support)
> **Last Updated:** 2026-03-28
> **Read this file alongside `Sacralink_Context.md` before touching the AI chatbot features.**

---

## 1. Feature Status: IMPLEMENTED ✅
The AI Parishioner Assistant feature has been successfully implemented on both the frontend and backend. 
**Crucial Note:** During implementation, the architecture shifted from using OpenAI to **Google Gemini** APIs. The backend edge functions, database schema, and vector search are already active on Supabase.

---

## 2. Actual Implemented Architecture

```text
User types question
        │
        ▼
[Frontend: ChurchChatbot.tsx]  ←── /churches/:id
        │
        │  POST /functions/v1/church-ai-chat
        │  { churchId, message, conversationHistory }
        ▼
[Supabase Edge Function: church-ai-chat]
        │
        ├─ 1. Embed question → 768-dimension vector using `gemini-embedding-001`
        │
        ├─ 2. Vector search via Supabase RPC `match_church_knowledge`
        │      (Cosine similarity search on `church_knowledge_chunks`)
        │
        ├─ 3. Append matched chunks into Context
        │
        ├─ 4. Call Gemini Chat API (`gemini-2.0-flash-lite`, fallback to `-flash`)
        │
        └─ 5. Return JSON: { reply, sourcesUsed }
```

---

## 3. Tech Stack Used

| Component | Implemented Technology | Note |
|-----------|------------------------|------|
| **Chat Models** | Google Gemini | Tries `gemini-2.0-flash-lite`, falls back to `2.0-flash` or `2.5-flash` on rate limits |
| **Embeddings** | `gemini-embedding-001` | **768** dimensions |
| **Vector Database**| Supabase `pgvector` | Stored in `church_knowledge_chunks` |
| **Logic** | Supabase Edge Functions | Deployed directly to Supabase (`church-ai-chat`, `sync-church-knowledge`) |

---

## 4. Supabase Database Integration

### `church_knowledge_chunks` (Vector Store)
Stores the chunked text data for each church.
- **`id`**: UUID primary key
- **`church_id`**: UUID (refs `churches`)
- **`content`**: TEXT (the raw text chunk)
- **`embedding`**: VECTOR(768)
- **`source_type`**: TEXT (e.g., 'announcement', 'requirement')
- **`source_id`**: UUID
- **`created_at`**, **`updated_at`**: TIMESTAMPTZ

### `church_chat_logs` (Audit Logging)
Automatically logs authenticated users' interactions with the AI.
- Logs `user_id`, `church_id`, `question`, and `answer`.

### RPC Functions
- **`match_church_knowledge`**: A PL/pgSQL function taking `query_embedding` (number array), `match_church_id` (uuid), and `match_count` (int). It returns the highest-scoring text chunks using vector cosine similarity.

---

## 5. Supabase Edge Functions

There are two primary edge functions live on your Supabase project:

### 1. `sync-church-knowledge`
- **Purpose:** Fetches a church's announcements, mass schedules, requirements, etc., embeds them using `gemini-embedding-001`, and upserts them into `church_knowledge_chunks`.
- **Trigger:** Currently triggered manually by clicking the **"Sync AI Knowledge Base"** button in `ChurchAdminDashboard.tsx`.

### 2. `church-ai-chat`
- **Purpose:** Handles the live chat queries from the frontend widget.
- **Failover Logic:** It includes robust fail-over logic. If `gemini-2.0-flash-lite` hits a 429 Error (Quota Exceeded), it gracefully falls back to `gemini-2.0-flash`, then to `gemini-2.5-flash`.
- **System Prompting:** Injects the `churches.name` and contact details directly into the context, so the bot knows how to tell users to call the parish if an answer isn't in the database.

---

## 6. Frontend Components

The frontend lives entirely locally in your repository at `web/src/components/ai/`:
1. `ChurchChatbot.tsx`: The interactive floating chat window.
2. `ChatMessage.tsx`: Renders individual chat bubbles.
3. `ChatInput.tsx`: The input field with sending states.
- The `featureFlags.ts` file has `parishionerChatbot` enabled.

---

## 7. Current Status & Next Steps

**Status:** The backend is 100% written and deployed to Supabase. The frontend UI is integrated.

**Need Tweaks?** 
If making tweaks, remember:
- You must **redeploy** edge functions using `supabase functions deploy [function-name]` if you change the Deno code.
- Always ensure `GEMINI_API_KEY` is set in your Supabase secrets.

*End of Context Document*
