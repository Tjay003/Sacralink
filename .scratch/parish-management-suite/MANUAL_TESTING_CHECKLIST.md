# SacraLink — Parish Management Suite: Manual QA Testing Checklist

This manual testing guide provides end-to-end user journeys, role-based testing steps, and interactive verification checklists for all 5 tickets of the **Parish Management Suite**.

---

## 📋 Test Environment Setup &amp; User Credentials

Before starting manual tests, ensure the local web server and database backend are running:

- **Dev Server:** Run `npm --prefix web run dev` (starts on `http://localhost:5173`)
- **Default Database Accounts (Personas):**
  - **Super Admin:** `user1@gmail.com` / `Lolgamers_123` (Diocese Chancery administrator)
  - **Church Admin (Parish A):** `user2@gmail.com` / `Password123!` (Assigned to San Sebastian Cathedral)
  - **Church Admin (Parish B):** `user3@gmail.com` / `Password123!` (Assigned to Queen of Peace Parish)
  - **Parish Priest:** `user4@gmail.com` / `Password123!`
  - **Parish Volunteer:** `user5@gmail.com` / `Password123!`
  - **Regular Parishioner:** `user6@gmail.com` / `Password123!`

---

## 🧪 Ticket 01: Admin Church Categorization &amp; Multi-Column Sorting

**Test Route:** [`/admin/users`](http://localhost:5173/admin/users)

### User Journeys &amp; Scenarios

#### Scenario 1.1: Super Admin Global View &amp; Multi-Column Sorting

1. Log in as Super Admin (`user1@gmail.com`).
2. Navigate to **Users** in the sidebar (`/users`).
3. Observe the user table:
  - [x] Church names appear as readable text (e.g., "San Sebastian Cathedral") instead of raw UUID strings.
  
     [ ] Users without an assigned church display "Unassigned".
     [ ] **Hover Tooltip Card:** Hover cursor over any assigned parish name in the table. A floating card smoothly appears showing the full parish name, address, and diocese verification badge.
4. Test column headers sorting by clicking each header:
  - [x] **Role priority sorting:** Click the Role column to sort hierarchy (`Super Admin` -&gt; `Admin` -&gt; `Church Admin` -&gt; `Priest` -&gt; `Volunteer` -&gt; `Parishioner`).
  
     [ ] **Assigned Church sorting:** Click Church column to sort alphabetically by parish name.
     [ ] **Full Name sorting:** Click Name column to sort alphabetically.
     [ ] **Registration Date sorting:** Click Date column to sort newest/oldest.

#### Scenario 1.2: Church Filtering Dropdown &amp; Search

1. Locate the **Filter by Church** dropdown at the top right of the toolbar.
2. Select a specific church (e.g., "San Sebastian Cathedral").
  - [x] Table immediately filters to display only users assigned to that church.
3. Select "Unassigned Users".
  - [x] Table displays only parishioners without an assigned parish.
4. Type a query in the search bar (e.g., "Father" or parishioner name).
  - [x] Real-time filtering matches name, email, or parish name.

#### Scenario 1.3: Group by Parish Accordion Mode

1. Click the **Group by Parish** view toggle button in the top toolbar.
  - [x] View switches from flat table to collapsible parish accordion cards.
  
     [ ] Each parish card displays total user count, admin count, priest count, volunteer count, and parishioner count.
2. Click on a parish accordion header (e.g., "San Sebastian Cathedral").
  - [x] Accordion expands to reveal the full staff and parishioner roster for that church.
3. Click "Expand All" / "Collapse All" if present, or toggle individual cards.
  - [x] Accordion opens and closes smoothly with zero layout glitch.

#### Scenario 1.4: Church Admin Scoped View

1. Log out and log in as Church Admin (`user2@gmail.com`).
2. Navigate to **Users**.
  - [x] Church Admin only sees staff and members belonging to their assigned parish.
  
     [ ] Users from other parishes and global Super Admins are hidden.

---

## 🗺️ Ticket 02: Interactive Parish Map &amp; Coordinate Storage

**Test Routes:** 

- Add Church: [`/churches/add`](http://localhost:5173/churches/add)
- Edit Church: [`/churches/:id/edit`](http://localhost:5173/churches/church-1/edit)
- Church Details: [`/churches/:id`](http://localhost:5173/churches/church-1)

### User Journeys &amp; Scenarios

#### Scenario 2.1: OpenStreetMap Leaflet Pin Placement

1. Log in as Super Admin (`user1@gmail.com`).
2. Navigate to **Churches** -&gt; click **Add Church** (`/churches/add`).
3. Scroll down to the **Parish Map Location &amp; Coordinates** section.
  - [x] Leaflet map container renders with OpenStreetMap tiles.
  
     [ ] Default map center is City of San Jose del Monte, Bulacan (`14.8135, 121.0453`).
4. Click anywhere on the map:
  - [x] Draggable church pin marker moves to the clicked location.
  
     [ ] Latitude and Longitude readouts update in real time.
     [ ] Green "PIN SET" status pill displays rounded coordinates.
5. Click and drag the marker pin:
  - [x] Pin drags smoothly and coordinates update upon release.

#### Scenario 2.2: Live Address Geocoding Search

1. In the search box above the map ("Search church address, landmark, or barangay..."), type: `St. Joseph the Worker, San Jose del Monte`.
2. Click **Search Location** (or press Enter).
  - [x] Search spinner appears.
  
     [ ] Dropdown appears showing matching Nominatim places with address previews.
3. Click one of the search results:
  - [x] Map smoothly pans and zooms to the selected location.
  
     [ ] Pin drops at the exact coordinates.
     [ ] Address notification banner appears offering "Use as Address".

#### Scenario 2.3: Manual Coordinate Entry &amp; GPS Geolocation

1. Test the **Use Current GPS** button:
  - [x] Browser prompts for location permission (or uses mock location).
  
     [ ] Pin centers on browser location if granted.
2. Scroll to the **Coordinates Fine-Tuning (WGS84)** form:
  - [x] Type Latitude: `14.825000` and Longitude: `121.060000`.
  
     [ ] Click **Apply Coordinates**.
     [ ] Pin and map jump immediately to `14.825000, 121.060000`.
3. Test invalid coordinates validation:
  - [x] Type Latitude: `999.0` and click Apply.
  
     [ ] Inline red error banner displays: *"Please enter a valid latitude between -90 and 90."* without uncaught exceptions.

#### Scenario 2.4: Save &amp; Edit Persistence

1. Fill Church Name: `St. Jude Thaddeus Parish`, Address: `Brgy. Muzon, CSJDM`, set pin coordinates.
2. Click **Create Church**.
  - [x] Church is created and redirects to Church Details page.
  
     [ ] Church Details page displays Coordinates: `📍 Coordinates: 14.825000°, 121.060000°` and a link to `View on OpenStreetMap`.
3. Click **Edit Church**.
  - [x] Edit form pre-loads stored latitude and longitude and renders the pin on the existing coordinates.

---

## ⚡ Ticket 03: Smart Cross-Parish Availability &amp; Nearby Recommender

**Test Route:** [`/churches/:id/book`](http://localhost:5173/churches/church-1/book)

### User Journeys &amp; Scenarios

#### Scenario 3.1: Slot Collision Detection

1. Log in as Parishioner (`user6@gmail.com`).
2. Go to **Churches** -&gt; Select **San Sebastian Cathedral** -&gt; Click **Book Appointment** (`/churches/church-1/book`).
3. Select Service Type: `Baptism`.
4. Pick a taken / conflicting date and time (e.g., Date: `2026-09-15`, Time: `10:00 AM`).
  - [x] "Checking..." spinner appears momentarily beside the time field.
  
     [ ] Amber **Smart Recommendations** container appears below the inputs.
     [ ] Status banner explains that `Sep 15, 2026 at 10:00 AM` is fully booked.

#### Scenario 3.2: Card A — Earliest Slot at Current Parish

1. Inspect **Card A (Same Church)**:
  - [x] Displays next open time slot at San Sebastian Cathedral (e.g., `11:00 AM` or next available day).
  
     [ ] Displays button: **Select This Slot**.
2. Click **Select This Slot**:
  - [x] Preferred Time input in the form instantly updates to the recommended slot.
  
     [ ] Conflict warning clears or updates to available status.

#### Scenario 3.3: Card B — Nearest Alternative Parish

1. Pick `2026-09-15` at `10:00 AM` again to trigger the recommendation block.
2. Inspect **Card B (Nearest Alternative Parish)**:
  - [x] Displays the closest verified diocese parish offering Baptism on that date (e.g., `Queen of Peace Parish`).
  
     [ ] Displays calculated Haversine distance badge (e.g., `📍 3.2 km away`).
     [ ] Displays button: **Select This Parish**.
3. Click **Select This Parish**:
  - [x] URL seamlessly switches to the new parish booking route (`/churches/church-2/book`).
  
     [ ] Date, time, and service type selections are preserved.
     [ ] New church's specific sacrament requirements and guideline documents reload.

---

## 🛡️ Ticket 04: Strict Manual Parish Verification &amp; Donation Gate

**Test Routes:**

- Apply for Parish Onboarding: [`/churches/apply`](http://localhost:5173/churches/apply)
- Super Admin Applications Queue: [`/admin/applications`](http://localhost:5173/admin/applications)
- Unverified Church Detail: [`/churches/church-unverified-1`](http://localhost:5173/churches/church-unverified-1)

### User Journeys &amp; Scenarios

#### Scenario 4.1: Submit Parish Onboarding Application

1. Log in as Church Admin (`user2@gmail.com`) or Parishioner.
2. Navigate to **Churches** -&gt; Click **Onboard Parish** button (`/churches/apply`).
3. Complete the multi-section application:
  - **Section 1 (Parish Info):** Name (`St. Vincent Ferrer Parish`), Address, Contact Phone, Official Email.
  - **Section 2 (Location):** Set pin on map or enter coordinates.
  - **Section 3 (Cashless Merchant Info):** Enter GCash and Maya account names &amp; numbers.
  - **Section 4 (Mandatory Credentials):**
    - Upload CBCP Clergy ID / Celebret PDF or image.
    - Upload Chancery Appointment Decree PDF or image.
4. Click **Submit Verification Application**.
  - [x] Form validates all required documents.
  
     [ ] Success screen displays: *"Application Submitted Successfully to Diocese Chancery Super Admin queue"*.

#### Scenario 4.2: Donation Gating on Unverified Churches

1. Log in as Parishioner (`user6@gmail.com`).
2. Navigate to an unverified parish page ([`/churches/church-unverified-1`](http://localhost:5173/churches/church-unverified-1)).
  - [x] Header displays an amber **Verification Pending** badge.
  
     [ ] Prominent blue/amber banner displays: *"Cashless Donations Locked — Verification Pending (Anti-Fraud Gate)"*.
     [ ] Top action **Donate** button is disabled and displays **Locked**.
     [ ] QR code display and donation modal cannot be opened.

#### Scenario 4.3: Super Admin Anti-Fraud Checklist &amp; Approval

1. Log in as Super Admin (`user1@gmail.com`).
2. Navigate to **Parish Applications** (`/admin/applications`) from sidebar.
  - [x] Review queue lists pending parish applications with applicant name and status pill.
3. Click **Review &amp; Verify** on a pending application:
  - [x] Review modal opens with applicant info, merchant numbers, and clickable credential links (`CBCP Clergy ID / Celebret` and `Chancery Decree`).
  
     [ ] Clicking a document link opens the uploaded credential in a new tab.
4. Inspect the 3 anti-fraud checklist checkboxes:
  - [x] [ ] Rectory Phone Call Confirmed with Chancery
  
     [ ] [ ] CBCP Clergy ID / Celebret Verified with Diocese Roster
     [ ] [ ] Merchant Name / GCash / Maya Matches Legal Parish Entity
5. Attempt to click **Approve &amp; Activate Parish** without checking all 3 items:
  - [x] A clean **Incomplete Verification Checklist Modal** pops up (zero native browser alert popup), clearly showing which criteria are still pending.
  
     [ ] Clicking **Cancel &amp; Review** dismisses the warning modal to allow further inspection.
     [ ] Clicking **Activate Anyway** proceeds with overriding activation.
6. Check all 3 checkboxes, type review remarks in Chancery Notes, and click **Approve &amp; Activate Parish**:
  - [x] Application status updates to `Verified Active`.
  
     [ ] Church is marked `verified_active` in database.
     [ ] Church Detail page now displays the green **Verified Parish** badge and enables the **Donate** button.

---

## 💬 Ticket 05: Real-Time Messaging &amp; Embedded Video/Audio Conferencing

**Test Route:** [`/messages`](http://localhost:5173/messages)



`Notes: for the 5.1, i want it to be the name like any messages app, the name is the what it shows since right now` it shows parish member only, didnt show the picture on the left sidebar, and also the name, i think the only time the its going to show not its avatar is when its a community chat or parish chat channel, i also want to add delete conversation, only me or for Both something like that like telegram, it also keep doing the loading chats even i just altab, i think we can do better on this one

### User Journeys &amp; Scenarios

#### Scenario 5.1: Real-Time Messaging Interface &amp; Participant Resolution

1. Log in as Super Admin (`user1@gmail.com`) or Church Admin.
2. Click **Messages** in the navigation bar or sidebar (`/messages`).
  - [ ] Left pane displays conversation list with search filter, avatars, full names (or email fallback, never generic `"Direct Conversation"`), role badges (`Super Admin`, `Admin`, `Priest`, `Volunteer`, `Parishioner`), and parish name sub-tags.
  
     [ ] Right pane displays active conversation thread.
3. Click on a conversation (e.g., "Father Church Admin"):
  - [ ] Active chat header displays participant name, role badge, and parish info.
  
     [ ] Message history loads with distinct bubbles (sent vs received) and timestamps.
4. Type a message in the composer (e.g., *"Good day Father, please review the liturgical schedule."*) and press Enter:
  - [ ] Message immediately appends to thread with a sent checkmark.
  
     [ ] Conversation list updates snippet and timestamp.

#### Scenario 5.2: Directory &amp; New Message Modal

1. Click the **+ New Message** button on the left sidebar:
  - [ ] Modal opens displaying available clergy, parish admins, and staff contacts.
  
     [ ] Search input filters contacts by name or email.
2. Select a contact:
  - [ ] Modal closes and opens the 1-on-1 direct conversation with that user.

#### Scenario 5.3: Parish Staff Channel Access

1. **As Church Admin / Priest / Volunteer (`user2@gmail.com`):**
  - [ ] Click **Parish Staff Channel** in the sidebar: directly opens their assigned parish staff group channel.
2. **As Super Admin (`user1@gmail.com`):**
  - [ ] Click **Parish Staff Channel** in the sidebar: opens a **Select Parish Staff Channel Modal** listing all diocese parishes with search.
  
     [ ] Clicking any parish (e.g., "San Sebastian Cathedral") opens that parish's staff channel.

#### Scenario 5.4: Instant Audio/Video Call &amp; Jitsi Meet Modal

1. As a Church Admin / Priest / Super Admin, open any active conversation.
2. Click the green **Start Video Call** button in the chat header:
  - [x] **Video Conference Modal** opens with custom room name.
  
     [ ] Security badges display *"Live Room"*, *"End-to-End Encrypted"*, *"Zero Server Data Storage"*.
     [ ] Embedded Jitsi meeting interface loads with camera, microphone, screen sharing, and tile view controls.
3. Test Modal Controls:
  - [x] Click **Copy Link**: Toast / badge shows *"Copied!"* and direct meeting URL is in clipboard.
  
     [ ] Click **Fullscreen** toggle: Modal expands to full viewport.
     [ ] Click **Leave / Hangup** (red button): Modal closes cleanly.
4. Observe the chat thread after starting a call:
  - [x] An interactive **Parish Video Conference** call banner is posted in the conversation with a pulsing **Live Room** indicator.
  
     [ ] Both participants can click **Join Video Conference** to open the meeting room.

#### Scenario 5.5: Delete Conversation & Permanent Parish Staff Channel Protection

1. **Delete Direct Conversation ("Delete for Me" / "Delete for Everyone"):**
   - [ ] Open a direct conversation with any user.
   - [ ] Click the red **Trash / Delete** button in the chat header.
   - [ ] Modal opens offering "Delete for Me" and "Delete for Both of Us (Everyone)".
   - [ ] "Delete for Me" leaves the conversation intact for the other user; "Delete for Everyone" purges for both.
2. **Permanent Parish Staff Channel Protection:**
   - [ ] Open any Parish Staff Channel (`type = 'channel'`).
   - [ ] Verify that the red **Trash / Delete** button is completely **hidden** in the header.
   - [ ] Database RLS policy and API guards reject any deletion attempt on channels with explicit error: *"Parish staff channels are permanent and cannot be deleted."*

---

## 📱 Mobile Responsiveness &amp; Layout Polish Check

Test on both desktop (1920x1080) and mobile viewport (375x812 iPhone / 412x915 Android):

- [x] **Navigation Bar / Mobile Drawer:** Nav items and badge counts collapse cleanly without clipping.
- [x] **Leaflet Map:** Touch dragging and pinch-to-zoom work on mobile screens.
- [x] **Messaging Dual Pane:** On mobile, conversation list takes full screen; tapping a chat transitions smoothly into thread; back button returns to list.
- [x] **Consistent Light Theme:** All cards, sidebars, modals, and tables have clean white/slate backgrounds with high contrast and zero dark-mode leakage.

---

## ✅ Master Sign-Off Checklist

- [x] **Ticket 01:** Church Categorization, Hover Tooltip Card &amp; Multi-Column Sorting verified
- [x] **Ticket 02:** Leaflet Map, Geocoding &amp; Coordinate Storage verified
- [x] **Ticket 03:** Smart Cross-Parish Availability &amp; Dual Recommendation Cards verified
- [ ] **Ticket 04:** Parish Application Submission, Warning Modal &amp; Donation Gating verified
- [x] **Ticket 05:** Real-Time Messaging, Permanent Staff Channel Protection, Super Admin Parish Selector &amp; Video Conference verified
- [x] **Mobile Responsiveness:** Touch controls, drawers, and layouts verified on all breakpoints

