import type { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'church_admin' | 'volunteer' | 'user';
  assigned_church_id?: string | null;
  church_id?: string | null;
}

export const MOCK_USERS: Record<string, MockUser> = {
  super_admin: {
    id: 'user-id-superadmin-1',
    email: 'user1@gmail.com',
    full_name: 'Super Admin User',
    role: 'super_admin',
    assigned_church_id: null,
  },
  church_admin: {
    id: 'user-id-churchadmin-2',
    email: 'user2@gmail.com',
    full_name: 'Father Church Admin',
    role: 'church_admin',
    assigned_church_id: 'church-1',
  },
  parishioner: {
    id: 'user-id-parishioner-6',
    email: 'user6@gmail.com',
    full_name: 'Parishioner User',
    role: 'user',
    church_id: 'church-1',
  },
};

export const MOCK_CHURCHES = [
  {
    id: 'church-1',
    name: 'San Sebastian Cathedral',
    address: 'Rizal St, Bacolod City, Negros Occidental',
    contact_number: '+63 34 433 1234',
    email: 'sansebastian@diocese.ph',
    status: 'active',
    latitude: 14.8135,
    longitude: 121.0453,
    description: 'Historic cathedral in the heart of Bacolod City.',
    featured_image_url: 'https://images.unsplash.com/photo-1548625361-ec85301ff7a6?auto=format&fit=crop&q=80&w=800',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'church-2',
    name: 'Queen of Peace Parish',
    address: 'Capitol Shopping, Bacolod City',
    contact_number: '+63 34 434 5678',
    email: 'queenofpeace@diocese.ph',
    status: 'active',
    latitude: 14.821,
    longitude: 121.052,
    description: 'Active parish community offering daily sacraments.',
    featured_image_url: 'https://images.unsplash.com/photo-1548625361-ec85301ff7a6?auto=format&fit=crop&q=80&w=800',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export const MOCK_SYSTEM_ANNOUNCEMENTS = [
  {
    id: 'sys-1',
    title: 'System Maintenance Notice',
    content: 'Scheduled server maintenance this Sunday at 2 AM.',
    type: 'maintenance',
    priority: 'normal',
    is_active: true,
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sys-2',
    title: 'Diocese Youth Festival 2026',
    content: 'Registration is now open for all parishes.',
    type: 'info',
    priority: 'high',
    is_active: true,
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const MOCK_CHURCH_ANNOUNCEMENTS = [
  {
    id: 'ca-1',
    church_id: 'church-1',
    title: 'Fiesta Mass Schedule',
    content: 'Special fiesta masses scheduled for next Saturday.',
    category: 'mass_schedule',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    church: {
      id: 'church-1',
      name: 'San Sebastian Cathedral',
    },
  },
  {
    id: 'ca-2',
    church_id: 'church-1',
    title: 'Parish Youth General Assembly',
    content: 'All youth members are invited to the fellowship hall.',
    category: 'event',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
    church: {
      id: 'church-1',
      name: 'San Sebastian Cathedral',
    },
  },
];

export const MOCK_APPOINTMENTS = [
  {
    id: 'apt-1',
    user_id: 'user-id-parishioner-6',
    church_id: 'church-1',
    service_type: 'Baptism',
    status: 'approved',
    appointment_date: '2026-09-15',
    appointment_time: '10:00 AM',
    contact_number: '+63 912 345 6789',
    contact_email: 'user6@gmail.com',
    notes: 'First child baptism',
    created_at: '2026-01-01T00:00:00Z',
    church: {
      id: 'church-1',
      name: 'San Sebastian Cathedral',
    },
    user: {
      id: 'user-id-parishioner-6',
      full_name: 'Parishioner User',
      email: 'user6@gmail.com',
    },
  },
  {
    id: 'apt-2',
    user_id: 'user-id-parishioner-6',
    church_id: 'church-1',
    service_type: 'Wedding',
    status: 'pending',
    appointment_date: '2026-10-20',
    appointment_time: '02:00 PM',
    contact_number: '+63 912 345 6789',
    contact_email: 'user6@gmail.com',
    notes: 'Wedding inquiry',
    created_at: '2026-01-02T00:00:00Z',
    church: {
      id: 'church-1',
      name: 'San Sebastian Cathedral',
    },
    user: {
      id: 'user-id-parishioner-6',
      full_name: 'Parishioner User',
      email: 'user6@gmail.com',
    },
  },
];

/**
 * Setup route interception for Supabase APIs
 */
export async function setupSupabaseMocks(page: Page, activeUser?: MockUser | null) {
  // 1. Auth token route (Login password check)
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const postData = route.request().postDataJSON() || {};
    const { email, password } = postData;

    let matchedUser: MockUser | undefined;
    if (email === 'user1@gmail.com' && (password === 'Lolgamers_123' || password === 'password123')) {
      matchedUser = MOCK_USERS.super_admin;
    } else if (email === 'user2@gmail.com' && (password === 'lolgamers123' || password === 'password123')) {
      matchedUser = MOCK_USERS.church_admin;
    } else if (email === 'user6@gmail.com' && (password === 'lolgamers123' || password === 'password123')) {
      matchedUser = MOCK_USERS.parishioner;
    }

    if (!matchedUser) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: `mock-token-${matchedUser.id}`,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `mock-refresh-${matchedUser.id}`,
        user: {
          id: matchedUser.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: matchedUser.email,
          user_metadata: {
            full_name: matchedUser.full_name,
          },
          app_metadata: {
            provider: 'email',
            providers: ['email'],
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    });
  });

  // 2. Auth user route
  await page.route('**/auth/v1/user', async (route) => {
    const userToReturn = activeUser || MOCK_USERS.super_admin;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: userToReturn.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: userToReturn.email,
        user_metadata: {
          full_name: userToReturn.full_name,
        },
        app_metadata: {
          provider: 'email',
          providers: ['email'],
        },
      }),
    });
  });

  // 3. Profiles REST route
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'PATCH') {
      const body = route.request().postDataJSON() || {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...activeUser, ...body }]),
      });
    }

    // Specific user profile by ID
    for (const u of Object.values(MOCK_USERS)) {
      if (url.includes(`id=eq.${u.id}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              role: u.role,
              assigned_church_id: u.assigned_church_id || null,
              church_id: u.church_id || null,
              avatar_url: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ]),
        });
      }
    }

    // If activeUser is provided
    if (activeUser && url.includes(`id=eq.${activeUser.id}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: activeUser.id,
            email: activeUser.email,
            full_name: activeUser.full_name,
            role: activeUser.role,
            assigned_church_id: activeUser.assigned_church_id || null,
            church_id: activeUser.church_id || null,
            avatar_url: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ]),
      });
    }

    // List of all profiles (Users page)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        Object.values(MOCK_USERS).map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          assigned_church_id: u.assigned_church_id || null,
          church_id: u.church_id || null,
          avatar_url: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }))
      ),
    });
  });

  // 4. Churches REST route
  await page.route('**/rest/v1/churches*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const newChurch = Array.isArray(body)
        ? { ...body[0], id: 'church-new-created', created_at: '2026-01-01T00:00:00.000Z' }
        : { ...body, id: 'church-new-created', created_at: '2026-01-01T00:00:00.000Z' };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newChurch]),
      });
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON() || {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_CHURCHES[0], ...body }]),
      });
    }

    for (const c of MOCK_CHURCHES) {
      if (url.includes(`id=eq.${c.id}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...c, mass_schedules: [] }),
        });
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CHURCHES),
    });
  });

  // 5. System announcements REST route
  await page.route('**/rest/v1/system_announcements*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SYSTEM_ANNOUNCEMENTS),
    });
  });

  // 6. Church announcements REST route
  await page.route('**/rest/v1/church_announcements*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CHURCH_ANNOUNCEMENTS),
    });
  });

  // 7. Appointments REST route
  await page.route('**/rest/v1/appointments*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const newApt = {
        id: `apt-new-${Date.now()}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        ...body,
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newApt),
      });
    }

    if (url.includes('church_id=eq.church-2')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/0' },
        body: JSON.stringify([]),
      });
    }

    if (url.includes('church_id=eq.church-1')) {
      if (url.includes('appointment_date=eq.2026-09-15')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': '0-0/1' },
          body: JSON.stringify([MOCK_APPOINTMENTS[0]]),
        });
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': '0-1/2',
      },
      body: JSON.stringify(MOCK_APPOINTMENTS),
    });
  });

  // 8. Priest availability REST route
  await page.route('**/rest/v1/priest_availability*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // 9. Sacrament requirements REST route
  await page.route('**/rest/v1/sacrament_requirements*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // 10. Conversations REST route
  await page.route('**/rest/v1/conversations*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const newConv = {
        id: `conv-new-${Date.now()}`,
        type: 'direct',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...body,
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newConv),
      });
    }

    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'conv-1', updated_at: new Date().toISOString() }]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'conv-1',
          title: null,
          type: 'direct',
          church_id: 'church-1',
          created_by: 'user-id-superadmin-1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T10:00:00Z',
          church: MOCK_CHURCHES[0],
        },
        {
          id: 'conv-2',
          title: 'San Sebastian Staff Channel',
          type: 'channel',
          church_id: 'church-1',
          created_by: 'user-id-churchadmin-2',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T09:00:00Z',
          church: MOCK_CHURCHES[0],
        },
      ]),
    });
  });

  // 11. Conversation Participants REST route
  await page.route('**/rest/v1/conversation_participants*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const inserted = Array.isArray(body)
        ? body.map((b, idx) => ({ id: `cp-new-${idx}`, ...b, created_at: new Date().toISOString() }))
        : [{ id: `cp-new-${Date.now()}`, ...body, created_at: new Date().toISOString() }];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(inserted),
      });
    }

    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'cp-1', last_read_at: new Date().toISOString() }]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'cp-1',
          conversation_id: 'conv-1',
          user_id: activeUser ? activeUser.id : 'user-id-superadmin-1',
          last_read_at: '2026-01-02T09:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          profile: activeUser || MOCK_USERS.super_admin,
        },
        {
          id: 'cp-2',
          conversation_id: 'conv-1',
          user_id: 'user-id-churchadmin-2',
          last_read_at: '2026-01-02T10:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          profile: MOCK_USERS.church_admin,
        },
        {
          id: 'cp-3',
          conversation_id: 'conv-2',
          user_id: activeUser ? activeUser.id : 'user-id-superadmin-1',
          last_read_at: '2026-01-02T09:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          profile: activeUser || MOCK_USERS.super_admin,
        },
        {
          id: 'cp-4',
          conversation_id: 'conv-2',
          user_id: 'user-id-churchadmin-2',
          last_read_at: '2026-01-02T09:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          profile: MOCK_USERS.church_admin,
        },
      ]),
    });
  });

  // 12. Messages REST route
  await page.route('**/rest/v1/messages*', async (route) => {
    const method = route.request().method();
    const headers = route.request().headers();

    if (method === 'HEAD' || headers['prefer']?.includes('count=')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/0' },
        body: '',
      });
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const newMsg = {
        id: `msg-new-${Date.now()}`,
        created_at: new Date().toISOString(),
        sender: activeUser || MOCK_USERS.super_admin,
        ...body,
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newMsg),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-id-churchadmin-2',
          content: 'Good day! Please check the new baptism schedules.',
          message_type: 'text',
          metadata: {},
          created_at: '2026-01-02T09:30:00Z',
          sender: MOCK_USERS.church_admin,
        },
        {
          id: 'msg-2',
          conversation_id: 'conv-1',
          sender_id: activeUser ? activeUser.id : 'user-id-superadmin-1',
          content: 'Sure Father, I have reviewed and verified the schedule.',
          message_type: 'text',
          metadata: {},
          created_at: '2026-01-02T10:00:00Z',
          sender: activeUser || MOCK_USERS.super_admin,
        },
      ]),
    });
  });
}

/**
 * Helper to authenticate directly into a specific role before page load
 */
export async function authenticateAs(page: Page, role: 'super_admin' | 'church_admin' | 'parishioner') {
  const user = MOCK_USERS[role];

  await setupSupabaseMocks(page, user);

  // Set session into localStorage matching Supabase storage key
  await page.addInitScript((userData) => {
    const sessionObj = {
      access_token: `mock-token-${userData.id}`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `mock-refresh-${userData.id}`,
      user: {
        id: userData.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: userData.email,
        user_metadata: {
          full_name: userData.full_name,
        },
        app_metadata: {
          provider: 'email',
          providers: ['email'],
        },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    };

    localStorage.setItem('sb-oaczurouvaevebpimply-auth-token', JSON.stringify(sessionObj));
  }, user);
}
