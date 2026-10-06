# Specification: Client Mock Defense Preparation & System Hardening

## 1. Overview
Harden the SacraLink system (Web and Mobile) for the upcoming Client Mock Defense by eliminating presentation failure points, bridging the Church Admin pastoral video consultation workflow on mobile, providing Web AI Chatbot dual-resilience SQL fallback, and guaranteeing full UI rendering across all parishes.

## 2. Key Objectives
1. **Mobile Church Admin Video Consultations Access**:
   - Provide direct access to pastoral video consultations (`/priest/consultations`) for `church_admin` accounts in `mobile/app/(tabs)/admin/index.tsx`.
   - Add a "Launch Video Call" action button in `mobile/src/components/admin/AdminAppointmentCard.tsx` when appointments require virtual counseling.
2. **Web AI Chatbot Dual-Resilience SQL Fallback**:
   - Mirror Mobile's `generateFallbackResponse` into `web/src/components/ai/ChurchChatbot.tsx`.
   - If the Google Gemini Edge Function encounters quota exhaustion (HTTP 429), cold-start delays, or network jitter, query local Supabase tables directly (`churches`, `mass_schedules`, `sacrament_requirements`, `church_knowledge_chunks`) so parishioners always get instant answers.
3. **Web Virtual Sanctuary Fallback Photosphere**:
   - In `web/src/pages/churches/ChurchDetailPage.tsx`, provide a fallback equirectangular panorama URL when `church.panorama_url` is null (matching Mobile's `PanoramaViewerWebView.tsx`), ensuring the 360° Virtual Sanctuary card renders across all parishes.
4. **Verified Demo Credentials**:
   - Update `web/.env` and presentation documentation with verified live Supabase Cloud credentials, replacing the unassigned `user6` trap with clean parishioner account `user5@gmail.com`.
5. **Static Validation & Verification**:
   - Full TypeScript checks (`tsc --noEmit`) and build tests (`vite build`) passing with zero errors.
