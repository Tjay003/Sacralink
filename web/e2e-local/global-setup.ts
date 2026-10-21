import { PASSWORD, USERS, assertLocal, LOCAL_URL, serviceClient, type Role } from './support';

/** Idempotently seeds two parishes and one user per role in the LOCAL Supabase database. */
export default async function globalSetup() {
  assertLocal(LOCAL_URL);
  const db = serviceClient();

  const upsertChurch = async (name: string) => {
    const { data: existing } = await db.from('churches').select('id').eq('name', name).maybeSingle();
    if (existing) return existing.id as string;
    const { data, error } = await db
      .from('churches')
      .insert({ name, address: '1 Test Street', status: 'verified_active', is_active: true })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  };
  const churchId = await upsertChurch('Local Test Parish');
  const otherChurchId = await upsertChurch('Other Test Parish');

  // Every parish starts with the six starter services (the same call the web seeders make)
  for (const id of [churchId, otherChurchId]) {
    const { error } = await db.rpc('seed_church_service_types', { p_church_id: id });
    if (error) throw error;
  }

  const profileFor: Record<Role, { role: string; church: string | null; is_priest?: boolean }> = {
    church_admin: { role: 'church_admin', church: churchId },
    priest: { role: 'priest', church: churchId, is_priest: true },
    priest2: { role: 'priest', church: churchId, is_priest: true },
    parishioner: { role: 'user', church: null },
    other_admin: { role: 'church_admin', church: otherChurchId },
  };

  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  for (const role of Object.keys(USERS) as Role[]) {
    const { email, fullName } = USERS[role];
    let id = list.users.find((u) => u.email === email)?.id;
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw error;
      id = data.user.id;
    }
    const spec = profileFor[role];
    const { error } = await db.from('profiles').upsert({
      id,
      email,
      full_name: fullName,
      role: spec.role,
      church_id: spec.church,
      assigned_church_id: spec.church,
      is_priest: spec.is_priest ?? false,
      is_verified: true,
    });
    if (error) throw error;
  }
}
