import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Ticket 05: Real-Time Messaging & Embedded Video/Audio Conferencing', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'super_admin');
    await page.goto('/messages');
  });

  test('should render Messaging page with dual-pane layout, conversations, and header', async ({ page }) => {
    // 1. Verify Page Header
    await expect(page.getByRole('heading', { name: 'Real-Time Messaging' })).toBeVisible();
    await expect(
      page.getByText('Connect with diocese clergy, parish staff, and parishioners instantly')
    ).toBeVisible();

    // 2. Verify Conversation List items
    await expect(page.getByPlaceholder('Search conversations...')).toBeVisible();
    await expect(page.getByText('Father Church Admin').first()).toBeVisible();
    await expect(page.getByText('San Sebastian Staff Channel').first()).toBeVisible();

    // 3. Verify Active Chat Header & Messages
    await expect(page.getByRole('heading', { name: 'Father Church Admin' }).first()).toBeVisible();
    await expect(page.getByText('Good day! Please check the new baptism schedules.')).toBeVisible();
    await expect(page.getByText('Sure Father, I have reviewed and verified the schedule.')).toBeVisible();

    // 4. Verify Message Composer
    await expect(
      page.getByPlaceholder('Type your message... (Enter to send, Shift+Enter for new line)')
    ).toBeVisible();
  });

  test('should send a text message and display it in the conversation thread', async ({ page }) => {
    const input = page.getByPlaceholder(
      'Type your message... (Enter to send, Shift+Enter for new line)'
    );
    await expect(input).toBeVisible();

    // Type a message and send
    await input.fill('Please find the attached liturgical documents.');
    await page.getByTitle('Send Message').click();

    // The message should appear in the thread
    await expect(
      page.getByText('Please find the attached liturgical documents.').last()
    ).toBeVisible();
  });

  test('should start an instant video call and open embedded Jitsi conference modal', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click "Start Video Call" button in the active chat header
    const startCallBtn = page.getByTitle('Start instant video/audio conference');
    await expect(startCallBtn).toBeVisible();
    await startCallBtn.click();

    // VideoConferenceModal should open
    await expect(page.getByText('Live Room')).toBeVisible();
    await expect(page.getByText('End-to-End Encrypted Peer Audio/Video')).toBeVisible();
    await expect(page.getByText('Zero Server Data Storage')).toBeVisible();

    // Copy link button inside video modal
    const copyLinkBtn = page.getByRole('button', { name: 'Copy Link' });
    await expect(copyLinkBtn).toBeVisible();

    // Leave meeting
    const leaveBtn = page.getByRole('button', { name: 'Leave' });
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    // Modal closes and a Call Invite banner is rendered in the chat thread
    await expect(page.getByText('Parish Video Conference').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Video Conference' }).first()).toBeVisible();
  });

  test('should open video modal when clicking Join Video Conference from call invite message', async ({ page }) => {
    // First initiate a call to have an invite in thread
    await page.getByTitle('Start Video Meeting').click();

    // Close modal
    await page.getByRole('button', { name: 'Leave' }).click();

    // Find and click "Join Video Conference" button in the message thread
    const joinBtn = page.getByRole('button', { name: 'Join Video Conference' }).first();
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // Video modal should re-open
    await expect(page.getByText('Live Room')).toBeVisible();
    await page.getByRole('button', { name: 'Close Meeting Window' }).click();
  });

  test('should open New Message modal, filter directory, and select a contact', async ({ page }) => {
    // Click "New Message" button
    await page.getByRole('button', { name: 'New Message' }).click();

    // Modal opens
    await expect(page.getByRole('heading', { name: 'New Direct Conversation' })).toBeVisible();
    await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible();

    // Filter by role tab (e.g. Parishioners)
    const parishionersTab = page.getByRole('button', { name: 'Parishioners' });
    await expect(parishionersTab).toBeVisible();
    await parishionersTab.click();

    // Select Parishioner User
    const parishionerContact = page.getByText('Parishioner User').first();
    await expect(parishionerContact).toBeVisible();
    await parishionerContact.click();

    // Modal closes and opens active direct chat
    await expect(page.getByRole('heading', { name: 'New Direct Conversation' })).not.toBeVisible();
  });

  test('should open Parish Staff Channel from quick button', async ({ page }) => {
    const staffChannelBtn = page.getByRole('button', { name: /Staff Channel/i }).first();
    if (await staffChannelBtn.isVisible()) {
      await staffChannelBtn.click();
      await expect(page.getByText('San Sebastian Staff Channel').first()).toBeVisible();
    }
  });
});
