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
  - [ ] Log in as **Super Admin** (`user1@gmail.com`).
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
- [ ] **2.1 New Message Modal:**
  - [ ] Click the **+ New Message** button in the left sidebar or top right.
  - [ ] Modal opens with search input and role filter tabs (`All`, `Clergy`, `Admins`, `Volunteers`, `Parishioners`).
- [ ] **2.2 Contact Search & Filter:**
  - [ ] Type a name or email in the search bar: list filters in real time.
  - [ ] Switch between role filter tabs: only matching role contacts appear.
- [ ] **2.3 Open Conversation:**
  - [ ] Click any contact in the list:
  - [ ] Modal closes automatically and navigates to the active conversation with that user.

---

### 3. Real-Time Chat & Message History
- [ ] **3.1 Sending Text Messages:**
  - [ ] Type a message in the composer textarea (e.g., *"Hello Father, checking in on Sunday mass schedule."*).
  - [ ] Press **Enter** (or click the Send button).
  - [ ] Message appends immediately to the thread with your avatar, name, and current timestamp.
  - [ ] The left sidebar conversation item moves to the top and updates its snippet preview.
- [ ] **3.2 Multi-Window Real-Time Reception:**
  - [ ] Open a second browser window / incognito tab and log in as the recipient (e.g., `user2@gmail.com`).
  - [ ] Send a message from window A:
  - [ ] Window B receives and displays the incoming message in real time without manual page reload.
- [ ] **3.3 Unread Counter & Mark as Read:**
  - [ ] When an unread message arrives for a conversation that is not currently focused, an unread counter badge (e.g. `[1]`) appears in the sidebar.
  - [ ] Clicking that conversation marks the messages as read and clears the badge.

---

### 4. Parish Staff Channels & Super Admin Parish Selector
- [ ] **4.1 Church Admin / Priest / Volunteer Staff Channel:**
  - [ ] Log in as Church Admin (`user2@gmail.com`).
  - [ ] Click **Parish Staff Channel** in the sidebar.
  - [ ] Opens the group channel for their assigned church (e.g., *"San Sebastian Cathedral Staff Channel"*).
  - [ ] Header shows church icon and participant count.
- [ ] **4.2 Super Admin Parish Staff Channel Picker Modal:**
  - [ ] Log in as Super Admin (`user1@gmail.com`).
  - [ ] Click **Parish Staff Channel** in the sidebar.
  - [ ] The **Select Parish Staff Channel Modal** pops up with a search bar and list of all diocese churches.
  - [ ] Search for a parish (e.g. *"Queen of Peace"* or *"San Sebastian"*).
  - [ ] Click a parish: opens that specific parish's staff channel.

---

### 5. Instant Embedded Video/Audio Conferencing (Jitsi Meet)
- [ ] **5.1 Start Instant Video Call:**
  - [ ] In any active conversation, click the green **Start Video Call** button in the chat header.
  - [ ] The **Video Conference Modal** opens.
  - [ ] Badges show *"Live Room"*, *"End-to-End Encrypted"*, and *"Zero Server Data Storage"*.
  - [ ] Embedded Jitsi meeting iframe loads smoothly with camera and microphone access.
- [ ] **5.2 Video Call Controls:**
  - [ ] Click **Copy Link**: Toast/button confirms link copied to clipboard.
  - [ ] Click **Fullscreen** toggle: Modal expands to full viewport.
  - [ ] Click **Leave / Hangup** (red button): Meeting ends and modal closes cleanly.
- [ ] **5.3 Live Room Badge in Chat Thread:**
  - [ ] After initiating a call, an interactive **Parish Video Conference** invite card is posted in the chat thread.
  - [ ] Card shows a pulsing **Live Room** indicator and room identifier.
  - [ ] Click **Join Video Conference** button: re-launches the meeting modal directly.

---

### 6. Mobile Layout & Responsiveness
- [ ] **6.1 Mobile Viewport (375px / iPhone):**
  - [ ] On mobile, the left conversation list occupies full width.
  - [ ] Tapping a conversation opens the chat viewport full-screen.
  - [ ] Top-left **Back Arrow (←)** button returns to the conversation list.
  - [ ] Video conference modal scales properly to mobile screen size.

---

## 🎯 Master Ticket 05 Sign-Off Checklist

- [ ] **1. Direct Chat Identity:** Full names, real avatars, role badges, and parish tags display properly (never "Parish Member")
- [ ] **2. Directory & New Message:** Contact search and 1-on-1 chat creation verified
- [ ] **3. Real-Time Chat:** Message sending, history scrolling, and unread badges verified
- [ ] **4. Staff Channels:** Parish staff channel routing & Super Admin picker modal verified
- [ ] **5. Video Conferencing:** Embedded Jitsi modal, controls, and "Live Room" chat card verified
- [ ] **6. Mobile Responsiveness:** Mobile dual-pane navigation verified
