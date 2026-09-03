# 💬 Ticket 05: Real-Time Messaging & Embedded Video/Audio Conferencing — Dedicated Testing Checklist

**Test Route:** [`http://localhost:5173/messages`](http://localhost:5173/messages)  
**Database Tables Involved:** `conversations`, `conversation_participants`, `messages`, `profiles`

---

## 👥 Persona Test Accounts & Roles

| Persona | Email | Password | Role & Context |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `user1@gmail.com` | `Lolgamers_123` | Global Diocese Chancery Administrator |
| **Church Admin (Parish A)** | `user2@gmail.com` | `Password123!` | Admin of San Sebastian Cathedral |
| **Church Admin (Parish B)** | `user3@gmail.com` | `Password123!` | Admin of Queen of Peace Parish |
| **Parish Priest** | `user4@gmail.com` | `Password123!` | Clergy at San Sebastian Cathedral |
| **Parish Volunteer** | `user5@gmail.com` | `Password123!` | Volunteer at San Sebastian Cathedral |
| **Parishioner** | `user6@gmail.com` | `Password123!` | Regular Parishioner |

---

## 🧪 Detailed Step-by-Step Test Scenarios

### 1. Direct Messaging: Participant Resolution & UI Display
- [ ] **1.1 Identity Resolution in Sidebar:**
  - [ ] Log in as **Super Admin** (`user1@gmail.com`) or **Church Admin** (`user2@gmail.com`).
  - [ ] Navigate to `/messages`.
  - [ ] In the left sidebar conversation list, verify that direct conversations display:
    - [ ] Real user full name (e.g. *"John user2"*, *"Father Church Admin"*, *"Denzel Pulido"*), never generic `"Parish Member"`.
    - [ ] Avatar initial or profile photo.
    - [ ] Role Badge with correct colors:
      - `Super Admin` (Purple)
      - `Church Admin` (Blue)
      - `Priest` (Indigo)
      - `Volunteer` (Amber)
      - `Parishioner` (Gray/Slate)
    - [ ] Parish affiliation name (e.g. `• San Sebastian Cathedral`).
- [ ] **1.2 Active Chat Header Identity:**
  - [ ] Click on a direct conversation in the left sidebar.
  - [ ] The top header of the active chat pane resolves:
    - [ ] Matching recipient full name.
    - [ ] Role pill.
    - [ ] Assigned parish name or email fallback.

---

### 2. Directory & Starting a New Message
- [ ] **2.1 New Message Modal (Role Categories):**
  - [ ] Click the **+ New Message** button in the left sidebar or top right.
  - [ ] Modal opens with search input and role filter tabs:
    - [ ] **All Contacts**
    - [ ] **Church Admins** (includes parish admins, diocesan admins, super admins)
    - [ ] **Volunteers**
    - [ ] **Parishioners**
    - [ ] *(Note: "Priests" role tab has been removed as per diocese schema).*
- [ ] **2.2 Contact Search & Filter:**
  - [ ] Type a name or email in the search bar: list filters in real time.
  - [ ] Switch between role filter tabs: only matching role contacts appear.
- [ ] **2.3 Open Conversation:**
  - [ ] Click any contact in the list:
  - [ ] Modal closes automatically and navigates to the active conversation with that user.

---

### 3. Real-Time Chat & Live Unread Badges (No Refresh Needed)
- [ ] **3.1 Sending Text Messages:**
  - [ ] Type a message in the composer textarea (e.g., *"Hello Father, checking in on Sunday mass schedule."*).
  - [ ] Press **Enter** (or click the Send button).
  - [ ] Message appends immediately to the thread with your avatar, name, and current timestamp.
  - [ ] The left sidebar conversation item moves to the top and updates its snippet preview.
- [ ] **3.2 Live Unread Count Without Refreshing:**
  - [ ] Open two browser windows / incognito sessions: Window A as `user1@gmail.com`, Window B as `user2@gmail.com`.
  - [ ] On Window B, switch to a different conversation or stay idle on messages.
  - [ ] Send a message from Window A to `user2@gmail.com`.
  - [ ] In Window B, observe the conversation in the left sidebar:
    - [ ] Unread counter badge (e.g. `[1]`) immediately appears in real time **without needing to refresh the page**.
    - [ ] Snippet preview updates to the new message text.
    - [ ] The conversation moves to the top of the conversation list.
  - [ ] Click on that conversation in Window B: unread badge immediately clears.

---

### 4. Delete Conversation ("Delete for Me" vs "Delete for Everyone" & Parish Channel Protection)
- [ ] **4.1 Open Delete Modal (Direct Chats Only):**
  - [ ] In any active 1-on-1 direct conversation, click the red **Trash / Delete** button in the top-right chat header.
  - [ ] A custom confirmation modal opens displaying two choices:
    - 1. **Delete for Me:** Removes the conversation from your inbox only.
    - 2. **Delete for Both of Us (Everyone):** Permanently deletes the conversation and all messages for all participants.
- [ ] **4.2 Test "Delete for Me":**
  - [ ] Click **Delete for Me**.
  - [ ] Conversation disappears from your inbox list.
  - [ ] In the other participant's window, the conversation remains intact.
- [ ] **4.3 Test "Delete for Everyone":**
  - [ ] Open a conversation with test messages, click Delete -> **Delete for Everyone**.
  - [ ] Conversation and entire message history are permanently purged from both users' accounts.
- [ ] **4.4 Permanent Parish Staff Channel Protection:**
  - [ ] Switch to any Parish Staff Channel (`type = 'channel'`).
  - [ ] Verify that the red **Trash / Delete** button is **hidden / NOT rendered** in the chat header.
  - [ ] Verify database RLS (`public.conversations` DELETE policy) restricts deletion strictly to `type = 'direct'`.
  - [ ] Verify API helpers (`deleteConversationForMe`, `deleteConversationForEveryone`) reject channel deletions with error: *"Parish staff channels are permanent and cannot be deleted."*

---

### 5. Parish Staff Channels & Super Admin Parish Selector
- [ ] **5.1 Church Admin / Volunteer Staff Channel:**
  - [ ] Log in as Church Admin (`user2@gmail.com`).
  - [ ] Click **Parish Staff Channel** in the sidebar.
  - [ ] Opens the group channel for their assigned church (e.g., *"San Sebastian Cathedral Staff Channel"*).
  - [ ] Header shows church icon and participant count.
  - [ ] Verify the chat header has **no Delete button** (permanent channel protection).
- [ ] **5.2 Super Admin Parish Staff Channel Picker Modal:**
  - [ ] Log in as Super Admin (`user1@gmail.com`).
  - [ ] Click **Parish Staff Channel** in the sidebar.
  - [ ] The **Select Parish Staff Channel Modal** pops up with a search bar and list of all diocese churches.
  - [ ] Search for a parish (e.g. *"Queen of Peace"* or *"San Sebastian"*).
  - [ ] Click a parish: opens that specific parish's staff channel.

---

### 6. Instant Embedded Video/Audio Conferencing (Jitsi Meet)
- [ ] **6.1 Start Instant Video Call:**
  - [ ] In any active conversation, click the green **Start Video Call** button in the chat header.
  - [ ] The **Video Conference Modal** opens with custom room name.
  - [ ] Badges show *"Live Room"*, *"End-to-End Encrypted"*, and *"Zero Server Data Storage"*.
  - [ ] Embedded Jitsi meeting interface loads smoothly with camera and microphone access.
- [ ] **6.2 Video Call Controls:**
  - [ ] Click **Copy Link**: Toast/button confirms link copied to clipboard.
  - [ ] Click **Fullscreen** toggle: Modal expands to full viewport.
  - [ ] Click **Leave / Hangup** (red button): Meeting ends and modal closes cleanly.
- [ ] **6.3 Live Room Badge in Chat Thread:**
  - [ ] After initiating a call, an interactive **Parish Video Conference** invite card is posted in the chat thread.
  - [ ] Card shows a pulsing **Live Room** indicator and room identifier.
  - [ ] Click **Join Video Conference** button: re-launches the meeting modal directly.

---

### 7. Mobile Layout & Responsiveness
- [ ] **7.1 Mobile Viewport (375px / iPhone):**
  - [ ] On mobile, the left conversation list occupies full width.
  - [ ] Tapping a conversation opens the chat viewport full-screen.
  - [ ] Top-left **Back Arrow (←)** button returns to the conversation list.
  - [ ] Video conference modal scales properly to mobile screen size.

---

## 🎯 Master Ticket 05 Sign-Off Checklist

- [ ] **1. Direct Chat Identity:** Full names, real avatars, role badges, and parish tags display properly (never "Parish Member")
- [ ] **2. Directory & Role Tabs:** `priest` removed; tabs for Church Admins, Volunteers, Parishioners verified
- [ ] **3. Real-Time Chat & Badges:** Incoming unread badge increments live without page refresh; active messages mark read
- [ ] **4. Delete Conversation & Staff Channel Protection:** "Delete for Me" and "Delete for Everyone" verified for direct chats; Parish Staff Channels permanently protected from deletion (UI hidden, API guard, and DB RLS)
- [ ] **5. Staff Channels:** Parish staff channel routing & Super Admin picker modal verified
- [ ] **6. Video Conferencing:** Embedded Jitsi modal, controls, and "Live Room" chat card verified
- [ ] **7. Mobile Responsiveness:** Mobile dual-pane navigation verified
