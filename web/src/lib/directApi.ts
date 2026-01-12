// Direct API helper to bypass Supabase client AbortError
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function directFetchProfile(userId: string, accessToken: string) {
    console.log('🔧 Using direct API to fetch profile...');

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
        });

        if (!response.ok) {
            console.error('❌ Direct API error:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        console.log('✅ Direct API success:', data);
        return data[0] || null;
    } catch (err) {
        console.error('❌ Direct API exception:', err);
        return null;
    }
}
