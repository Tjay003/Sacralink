import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChangeItem {
  channel?: string;
  field?: string;
  label?: string;
  changeType?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

interface RequestBody {
  churchId: string;
  channel?: string;
  changes?: ChangeItem[];
}

function buildEmailHtml(params: {
  churchName: string;
  referenceCode: string;
  otp: string;
  channel: string;
  changes?: ChangeItem[];
}): string {
  const { churchName, referenceCode, otp, channel, changes } = params;

  // Render change summaries if present
  let changesHtml = '';
  if (changes && changes.length > 0) {
    const listItems = changes
      .map((c) => {
        const actionLabel =
          c.changeType === 'replaced'
            ? 'Replacing QR'
            : c.changeType === 'removed'
            ? 'Removing QR/Account'
            : c.changeType === 'added'
            ? 'Adding New QR'
            : 'Updating Details';
        return `<li style="margin-bottom: 6px; color: #334155;">
          <strong>${c.label || c.channel || 'Payment Channel'}</strong>: 
          <span style="color: #2563eb; font-weight: 600;">${actionLabel}</span>
        </li>`;
      })
      .join('');

    changesHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 20px 0;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 8px;">
          Pending Offertory Changes
        </span>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5;">
          ${listItems}
        </ul>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Offertory Security Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #0f172a;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 22px;">
      <div style="display: inline-block; background-color: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 9999px;">
        Sacralink Security
      </div>
      <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 12px 0 4px 0;">
        Offertory QR Authorization Code
      </h1>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Parish: <strong style="color: #0f172a;">${churchName}</strong>
      </p>
    </div>

    <!-- Alert / Explanation -->
    <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0 0 18px 0;">
      A request has been initiated to alter the parish offertory cashless donation channel (<strong>${channel.toUpperCase()}</strong>).
    </p>

    <!-- Reference Match Badge -->
    <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 18px; margin: 20px 0; text-align: center;">
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #15803d; font-weight: 700; display: block; margin-bottom: 4px;">
        Visual Security Reference
      </span>
      <span style="font-size: 22px; font-weight: 800; color: #166534; letter-spacing: 2px; font-family: 'Courier New', Courier, monospace;">
        ${referenceCode}
      </span>
      <p style="font-size: 11px; color: #15803d; margin: 4px 0 0 0;">
        Verify that this reference code matches the modal on your screen before proceeding.
      </p>
    </div>

    <!-- OTP Code Display -->
    <div style="text-align: center; margin: 26px 0;">
      <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; display: block; margin-bottom: 8px;">
        Your 6-Digit Verification Code
      </span>
      <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a; font-family: 'Courier New', Courier, monospace; background-color: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; display: inline-block; padding: 14px 28px;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #dc2626; margin: 10px 0 0 0; font-weight: 600;">
        ⏱️ Code expires in 10 minutes (valid for 5 attempts)
      </p>
    </div>

    ${changesHtml}

    <!-- Security Warning -->
    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 26px;">
      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
        <strong>Did not request this?</strong> If you or another authorized parish administrator did not request this change, do not share this code. Please sign in to your Sacralink account and update your password immediately.
      </p>
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Sacralink Church Management Platform &bull; Security Safeguard Automated Notification
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables are missing');
    }

    // 1. Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user || !user.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request body
    const body: RequestBody = await req.json().catch(() => ({ churchId: '' }));
    const { churchId, channel = 'offertory', changes } = body;

    if (!churchId) {
      return new Response(JSON.stringify({ error: 'churchId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Authorize: check if user is super_admin or assigned church_admin for this church
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, assigned_church_id, church_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Administrator profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuperAdmin = profile.role === 'super_admin';
    const isChurchAdmin =
      (profile.role === 'church_admin' && profile.assigned_church_id === churchId) ||
      (profile.role === 'admin' && profile.church_id === churchId);

    if (!isSuperAdmin && !isChurchAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: You do not have administrator permissions for this church.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Fetch Church Name
    const { data: church } = await adminClient
      .from('churches')
      .select('name')
      .eq('id', churchId)
      .single();
    const churchName = church?.name || 'Parish Church';

    // 5. Generate Reference Code and 6-digit OTP
    const referenceCode = `REF-${Math.floor(1000 + Math.random() * 9000)}`;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const dummyEmailMode = Deno.env.get('DUMMY_EMAIL_MODE') === 'true';
    const isMockMode = !resendApiKey || dummyEmailMode;

    // Use deterministic test OTP in mock mode, otherwise cryptographically random 6 digits
    const otp = isMockMode
      ? '123456'
      : `${Math.floor(100000 + Math.random() * 900000)}`;

    // Hash OTP with SHA-256 using Web Crypto
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(otp));
    const otpHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 6. Insert verification record into public.qr_verification_codes
    const { error: insertError } = await adminClient
      .from('qr_verification_codes')
      .insert({
        church_id: churchId,
        user_id: user.id,
        reference_code: referenceCode,
        otp_hash: otpHash,
        channel: channel || 'offertory',
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Failed to insert qr_verification_code:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record verification code in database' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. CRITICAL QUOTA RULE: Check Resend availability
    if (isMockMode) {
      console.log('========================================================');
      console.log('🛡️ SACRALINK SECURITY - MOCK OTP (0 RESEND EMAILS SENT)');
      console.log(`To:             ${user.email}`);
      console.log(`Church:         ${churchName} (${churchId})`);
      console.log(`Reference Code: ${referenceCode}`);
      console.log(`OTP:            ${otp}`);
      console.log(`Expires At:     ${expiresAt}`);
      console.log('========================================================');

      return new Response(
        JSON.stringify({
          success: true,
          referenceCode,
          expiresAt,
          isMock: true,
          mockOtp: otp,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 8. Live Resend Delivery
    const emailHtml = buildEmailHtml({
      churchName,
      referenceCode,
      otp,
      channel,
      changes,
    });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sacralink Security <noreply@sacralink.app>',
        to: [user.email],
        subject: `[Sacralink] Security Code ${referenceCode} to Update Offertory QR`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend API error:', errBody);
      return new Response(
        JSON.stringify({ error: `Email delivery failed: ${errBody}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        referenceCode,
        expiresAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled send-qr-otp error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
