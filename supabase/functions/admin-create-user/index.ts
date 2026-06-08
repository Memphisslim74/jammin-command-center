import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brandedWelcomeEmail(params: {
  displayName: string;
  email: string;
  password: string;
  role: string;
  app_url: string;
}) {
  return `
    <div style="margin:0;padding:0;background:#1a0f25;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
        <div style="background:#2d1b3d;border:1px solid rgba(233,30,140,.35);border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.28);">
          <h1 style="margin:0 0 8px;color:#e91e8c;font-size:30px;line-height:1.1;">Jammin Command Center</h1>
          <p style="margin:0 0 24px;color:#c9c0d3;font-size:15px;">Your account has been created.</p>
          <p style="font-size:16px;line-height:1.55;color:#ffffff;margin:0 0 18px;">Hi ${params.displayName},</p>
          <p style="font-size:16px;line-height:1.55;color:#ffffff;margin:0 0 18px;">You now have access to the Jammin Command Center. Use the login details below to sign in.</p>
          <div style="background:rgba(255,255,255,.06);border:1px solid rgba(233,30,140,.25);border-radius:14px;padding:18px;margin:22px 0;">
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Email:</strong> ${params.email}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Temporary Password:</strong> ${params.password}</p>
            <p style="margin:0;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Role:</strong> ${params.role}</p>
          </div>
          <a href="${params.app_url}" style="display:inline-block;background:linear-gradient(135deg,#e91e8c,#764ba2);color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;padding:14px 20px;margin:8px 0 22px;">Open Command Center</a>
          <p style="font-size:14px;line-height:1.5;color:#c9c0d3;margin:0;">Please keep this information secure. If you have trouble signing in, contact your administrator.</p>
        </div>
        <p style="text-align:center;color:#8f829b;font-size:12px;margin:18px 0 0;">Jammin Command Center</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const PROJECT_ANON_KEY = Deno.env.get("PROJECT_ANON_KEY");
    const PROJECT_SERVICE_ROLE_KEY = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!PROJECT_URL || !PROJECT_ANON_KEY || !PROJECT_SERVICE_ROLE_KEY) {
      throw new Error("Missing project secrets.");
    }

    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(PROJECT_URL, PROJECT_ANON_KEY, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const adminClient = createClient(PROJECT_URL, PROJECT_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated.");

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (requesterProfileError) throw requesterProfileError;
    if (requesterProfile?.role !== "admin") throw new Error("Only admins can create users.");

    const body = await req.json();
    const email = body.email?.trim();
    const password = body.password;
    const role = body.role || "user";
    const full_name = body.full_name?.trim() || "";
    const phone = body.phone?.trim() || "";
    const app_url = body.app_url || "https://your-command-center-url.pages.dev";

    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Temporary password must be at least 6 characters.");
    if (!["admin", "manager", "user"].includes(role)) throw new Error("Invalid role.");

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createUserError) throw createUserError;
    const newUserId = createdUser.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: newUserId,
      email,
      role,
      full_name,
      phone,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    let emailSent = false;
    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Jammin Command Center <onboarding@resend.dev>",
          to: [email],
          subject: "Your Jammin Command Center account is ready",
          html: brandedWelcomeEmail({
            displayName: full_name || email,
            email,
            password,
            role,
            app_url,
          }),
        }),
      });

      if (!emailResponse.ok) {
        const result = await emailResponse.json();
        throw new Error("User created, but welcome email failed: " + JSON.stringify(result));
      }
      emailSent = true;
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId, email, role, email_sent: emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
