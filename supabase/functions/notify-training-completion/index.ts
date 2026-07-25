import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type CompletedTrainingRecord = {
  training_category_id: string;
  status: string;
  completion_date: string | null;
  completed_by_name: string | null;
  custom_label: string | null;
};

function completionEmail(params: {
  djName: string;
  completedItems: Array<{ name: string; completion_date: string; completed_by_name: string }>;
  appUrl: string;
}) {
  const rows = params.completedItems.map((item) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #ead8e3;color:#2b2030;">${escapeHtml(item.name)}</td>
      <td style="padding:10px;border-bottom:1px solid #ead8e3;color:#2b2030;">${escapeHtml(item.completion_date)}</td>
      <td style="padding:10px;border-bottom:1px solid #ead8e3;color:#2b2030;">${escapeHtml(item.completed_by_name)}</td>
    </tr>`).join("");

  return `
    <div style="margin:0;padding:0;background:#1a0f25;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:700px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.30);">
          <div style="background:linear-gradient(135deg,#e91e8c,#764ba2);padding:28px;">
            <h1 style="margin:0 0 8px;color:#ffffff;font-size:30px;line-height:1.1;">JAMMIN Training Complete</h1>
            <p style="margin:0;color:#f8ddeb;font-size:15px;">Your DJ training record has been verified.</p>
          </div>
          <div style="padding:28px;color:#2b2030;">
            <p style="font-size:16px;line-height:1.55;margin:0 0 16px;">Hi ${escapeHtml(params.djName)},</p>
            <p style="font-size:16px;line-height:1.55;margin:0 0 20px;">Your required JAMMIN DJ training items are complete. The verified record is listed below.</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #ead8e3;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f7edf3;">
                  <th style="padding:10px;text-align:left;color:#7a2154;">Training</th>
                  <th style="padding:10px;text-align:left;color:#7a2154;">Completed</th>
                  <th style="padding:10px;text-align:left;color:#7a2154;">Signed Off By</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <a href="${escapeHtml(params.appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#e91e8c,#764ba2);color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:13px 18px;margin-top:22px;">Open Command Center</a>
            <p style="font-size:13px;line-height:1.5;color:#756a7b;margin:22px 0 0;">A confirmation copy of this message was sent to JAMMIN management.</p>
          </div>
        </div>
        <p style="text-align:center;color:#9a8aa4;font-size:12px;margin:18px 0 0;">JAMMIN Command Center</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const projectUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("PROJECT_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("COMMAND_CENTER_URL") || "https://jdjcommand.myjammindjs.com";

    if (!projectUrl || !anonKey || !serviceKey || !resendKey) {
      throw new Error("Missing required Supabase or Resend secrets.");
    }

    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(projectUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated.");

    const { data: requester, error: requesterError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();
    if (requesterError) throw requesterError;
    if (!requester || !["admin", "manager"].includes(requester.role)) {
      throw new Error("Only administrators and managers can send training completion emails.");
    }

    const body = await req.json();
    const djUserId = body.dj_user_id;
    if (!djUserId) throw new Error("DJ user ID is required.");

    const { data: dj, error: djError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("id", djUserId)
      .single();
    if (djError) throw djError;
    if (!dj?.email) throw new Error("The DJ profile does not have an email address.");

    const { data: requiredCategories, error: categoryError } = await adminClient
      .from("training_categories")
      .select("id, name, sort_order")
      .eq("active", true)
      .eq("is_required", true)
      .order("sort_order", { ascending: true });
    if (categoryError) throw categoryError;

    const { data: records, error: recordsError } = await adminClient
      .from("staff_training")
      .select("training_category_id, status, completion_date, completed_by_name, custom_label")
      .eq("dj_user_id", djUserId)
      .eq("status", "complete");
    if (recordsError) throw recordsError;

    const completedByCategory = new Map<string, CompletedTrainingRecord>((records || []).map((record: CompletedTrainingRecord) => [record.training_category_id, record]));
    const missing = (requiredCategories || []).filter((category) => !completedByCategory.has(category.id));
    if (missing.length) {
      throw new Error(`Training is not complete. Missing: ${missing.map((item) => item.name).join(", ")}.`);
    }

    const completedItems = (requiredCategories || []).map((category) => {
      const record = completedByCategory.get(category.id)!;
      return {
        name: category.name,
        completion_date: record.completion_date || "",
        completed_by_name: record.completed_by_name || "Unknown",
      };
    });

    const { data: managers, error: managerError } = await adminClient
      .from("profiles")
      .select("email")
      .eq("role", "manager")
      .eq("status", "active");
    if (managerError) throw managerError;

    let managerRecipients = [...new Set((managers || []).map((item) => item.email).filter(Boolean))] as string[];
    managerRecipients = managerRecipients.filter((email) => email.toLowerCase() !== dj.email.toLowerCase());

    if (!managerRecipients.length) {
      const { data: fallback } = await adminClient
        .from("notification_settings")
        .select("recipients")
        .eq("form_type", "Default")
        .maybeSingle();
      managerRecipients = fallback?.recipients || [];
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "JAMMIN Command Center <notifications@command.myjammindjs.com>",
        to: [dj.email],
        cc: managerRecipients,
        subject: `JAMMIN DJ training complete — ${dj.full_name || dj.email}`,
        html: completionEmail({
          djName: dj.full_name || dj.email,
          completedItems,
          appUrl,
        }),
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      await adminClient.from("training_completion_notifications").insert({
        dj_user_id: djUserId,
        sent_by_user_id: requester.id,
        sent_by_name: requester.full_name || requester.email,
        sent_to: dj.email,
        manager_recipients: managerRecipients,
        completed_items: completedItems,
        delivery_status: "failed",
        error_message: JSON.stringify(emailResult),
      });
      throw new Error(`Resend rejected the completion email: ${JSON.stringify(emailResult)}`);
    }

    const { error: logError } = await adminClient.from("training_completion_notifications").insert({
      dj_user_id: djUserId,
      sent_by_user_id: requester.id,
      sent_by_name: requester.full_name || requester.email,
      sent_to: dj.email,
      manager_recipients: managerRecipients,
      completed_items: completedItems,
      delivery_status: "sent",
      resend_message_id: emailResult?.id || null,
    });
    if (logError) throw logError;

    return new Response(JSON.stringify({
      success: true,
      sent_to: dj.email,
      manager_recipients: managerRecipients,
      resend_message_id: emailResult?.id || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Training completion email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
