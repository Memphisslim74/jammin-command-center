import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brandedSubmissionEmail(entry: Record<string, string>) {
  return `
    <div style="margin:0;padding:0;background:#1a0f25;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
        <div style="background:#2d1b3d;border:1px solid rgba(233,30,140,.35);border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.28);">
          <h1 style="margin:0 0 8px;color:#e91e8c;font-size:30px;line-height:1.1;">Jammin Command Center</h1>
          <p style="margin:0 0 24px;color:#c9c0d3;font-size:15px;">New ${entry.type || "submission"} submitted</p>
          <div style="background:rgba(255,255,255,.06);border:1px solid rgba(233,30,140,.25);border-radius:14px;padding:18px;margin:22px 0;">
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Type:</strong> ${entry.type || ""}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Name:</strong> ${entry.djName || ""}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Date:</strong> ${entry.date || ""}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Details:</strong> ${entry.details || ""}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Amount / Time:</strong> ${entry.amountOrTime || ""}</p>
            <p style="margin:0 0 10px;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Status:</strong> ${entry.status || "Pending"}</p>
            <p style="margin:0;color:#c9c0d3;font-size:14px;"><strong style="color:#ffffff;">Notes:</strong> ${entry.notes || "None"}</p>
          </div>
          <p style="font-size:14px;line-height:1.5;color:#c9c0d3;margin:0;">Log in to the Command Center to review or approve this submission.</p>
        </div>
        <p style="text-align:center;color:#8f829b;font-size:12px;margin:18px 0 0;">Jammin Command Center</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const PROJECT_SERVICE_ROLE_KEY = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!PROJECT_URL || !PROJECT_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      throw new Error("Missing required secrets.");
    }

    const entry = await req.json();
    const supabaseAdmin = createClient(PROJECT_URL, PROJECT_SERVICE_ROLE_KEY);

    const { data: route } = await supabaseAdmin
      .from("notification_settings")
      .select("recipients")
      .eq("form_type", entry.type)
      .maybeSingle();

    const { data: fallbackRoute } = await supabaseAdmin
      .from("notification_settings")
      .select("recipients")
      .eq("form_type", "Default")
      .maybeSingle();

    const to = route?.recipients?.length
      ? route.recipients
      : fallbackRoute?.recipients?.length
        ? fallbackRoute.recipients
        : ["steve@myjammindjs.com"];

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jammin Command Center <onboarding@resend.dev>",
        to,
        subject: `New ${entry.type || "submission"} awaiting review`,
        html: brandedSubmissionEmail(entry),
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, to, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
