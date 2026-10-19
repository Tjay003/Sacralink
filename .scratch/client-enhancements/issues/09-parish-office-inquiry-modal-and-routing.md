# Issue 09: Parish Office Inquiry Modal & Shared Inbox Routing

Type: feature
Status: resolved
Blocked by: 

---

## 1. Description
Currently, clicking the "Message office" button on `ChurchDetailPage.tsx` attempts an immediate direct 1-on-1 query to a single assigned staff profile, failing or throwing an error banner if no admin is present or when routing. Furthermore, users lack context for why they are initiating a message, leading to empty or unorganized direct chats.

To solve this:
1. **Unstaffed Parish Gating**:
   - Check if the church has at least one active staff member (`church_admin` or `admin` assigned to `church.id`).
   - If 0 staff are assigned, hide or disable the "Message office" button (with a helpful tooltip: *"Parish office online desk not yet activated"*).
2. **Inquiry Ticket Modal (`ParishInquiryModal.tsx`)**:
   - When a user clicks "Message office", open a clean modal with:
     - Header: Church Name & Logo + *"Contact Parish Office"*.
     - Simple Subject Field (e.g., "Baptism Schedule Inquiry", "Mass Offering").
     - Message Textarea (detailed inquiry notes).
     - Submit Action: *"Send Inquiry to Parish Office"*.
3. **Shared Parish Inbox Routing**:
   - Upon submitting the inquiry, create/link a conversation tagged with `church_id: church.id` and `type: 'group'` / shared parish office thread containing the inquiry subject.
   - Insert the inquiry text as the opening message with a distinct tag or subject header.
   - Add all assigned parish staff members and the requesting user as conversation participants.
   - Automatically redirect the user to `/messages?conv=<id>` with the new inquiry thread pre-selected.

### Files Involved
- [web/src/pages/churches/ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx)
- [web/src/components/churches/ParishInquiryModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/churches/ParishInquiryModal.tsx)
- [web/src/lib/supabase/messaging.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/messaging.ts)
- [web/src/pages/messages/MessagingPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/messages/MessagingPage.tsx)

---

## 2. Acceptance Criteria
- [x] If a church has 0 assigned staff, "Message office" is gracefully disabled with an explanatory tooltip or hidden.
- [x] Clicking "Message office" on a staffed church opens the `ParishInquiryModal`.
- [x] Submitting Subject & Message creates a shared conversation linked to the church and delivers the message to all church staff.
- [x] Navigates user to `/messages?conv=<id>` with the newly created inquiry active.
- [x] Builds cleanly and passes TypeScript validation (`tsc -b`).
