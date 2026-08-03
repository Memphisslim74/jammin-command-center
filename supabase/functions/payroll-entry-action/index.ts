import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SourceConfig = {
  table: string;
  label: string;
  nameField: string;
  dateField: string;
  detailsField: string;
  amount: (record: Record<string, unknown>) => string;
};

const sourceConfig: Record<string, SourceConfig> = {
  commission: {
    table: "commissions",
    label: "Commission",
    nameField: "dj_name",
    dateField: "date",
    detailsField: "event_name",
    amount: (record) => `$${Number(record.amount || 0).toFixed(2)}`,
  },
  show: {
    table: "shows",
    label: "Show",
    nameField: "dj_name",
    dateField: "date",
    detailsField: "venue_name",
    amount: (record) => `$${Number(record.show_pay_amount || 0).toFixed(2)}`,
  },
  manager_hours: {
    table: "manager_hours",
    label: "Management Hours",
    nameField: "manager_name",
    dateField: "date",
    detailsField: "event_name",
    amount: (record) => {
      const hours = Number(record.hours || 0);
      const rate = Number(record.hourly_rate || 0);
      return `${hours.toFixed(2)} hours at $${rate.toFixed(2)}/hr — $${(hours * rate).toFixed(2)}`;
    },
  },
  equipment_hours: {
    table: "equipment_hours",
    label: "Equipment Hours",
    nameField: "submitted_by",
    dateField: "date",
    detailsField: "event_name",
    amount: (record) => {
      const hours = Number(record.hours || 0);
      const rate = Number(record.hourly_rate || 0);
      return `${hours.toFixed(2)} hours at $${rate.toFixed(2)}/hr — $${(hours * rate).toFixed(2)}`;
    },
  },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function denialEmail(params: {
  displayName: string;
  type: string;
  date: string;
  details: string;
  amount: string;
  notes: string;
  reason: string;
  appUrl: string;
}) {
  return `
    <div style="margin:0;padding:0;background:#170d20;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:650px;margin:0 auto;padding:32px 18px;">
        <div style="background:#2d1b3d;border:1px solid rgba(233,30,140,.35);border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.28);">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#ff57b1;font-weight:700;margin-bottom:8px;">JAMMIN' Command Center</div>
          <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;line-height:1.15;">Payroll submission needs a correction</h1>
          <p style="font-size:16px;line-height:1.55;color:#ffffff;margin:0 0 18px;">Hi ${escapeHtml(params.displayName)},</p>
          <p style="font-size:15px;line-height:1.6;color:#d2c8d9;margin:0 0 20px;">A payroll submission was denied because it needs to be corrected. Review the entry and reason below, then submit a corrected entry through the Command Center.</p>

          <div style="background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:18px;margin:0 0 18px;">
            <p style="margin:0 0 9px;color:#d2c8d9;font-size:14px;"><strong style="color:#ffffff;">Submission:</strong> ${escapeHtml(params.type)}</p>
            <p style="margin:0 0 9px;color:#d2c8d9;font-size:14px;"><strong style="color:#ffffff;">Date:</strong> ${escapeHtml(params.date)}</p>
            <p style="margin:0 0 9px;color:#d2c8d9;font-size:14px;"><strong style="color:#ffffff;">Details:</strong> ${escapeHtml(params.details)}</p>
            <p style="margin:0 0 9px;color:#d2c8d9;font-size:14px;"><strong style="color:#ffffff;">Amount / Hours:</strong> ${escapeHtml(params.amount)}</p>
            <p style="margin:0;color:#d2c8d9;font-size:14px;"><strong style="color:#ffffff;">Original Notes:</strong> ${escapeHtml(params.notes || "None")}</p>
          </div>

          <div style="background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.34);border-radius:14px;padding:18px;margin:0 0 22px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#fca5a5;font-weight:700;margin-bottom:7px;">Reason for denial</div>
            <div style="font-size:15px;line-height:1.6;color:#ffffff;">${escapeHtml(params.reason)}</div>
          </div>

          <a href="${escapeHtml(params.appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#e91e8c,#8b4ab8);color:#ffffff;text-decoration:none;font-weight:700;border-radius:9px;padding:13px 18px;">Open Command Center</a>
          <p style="font-size:13px;line-height:1.5;color:#a99db2;margin:20px 0 0;">Please submit a corrected entry rather than editing the denied record.</p>
        </div>
        <p style="text-align:center;color:#817487;font-size:12px;margin:18px 0 0;">JAMMIN' Command Center</p>
      </div>
    </div>`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const projectUrl = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("PROJECT_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("PROJECT_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("COMMAND_CENTER_FROM_EMAIL") || "JAMMIN' Command Center <notifications@command.myjammindjs.com>";
    const appUrl = Deno.env.get("COMMAND_CENTER_URL") || "https://jdjcommand.myjammindjs.com";

    if (!projectUrl || !anonKey || !serviceRoleKey) throw new Error("Missing Supabase function secrets.");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(projectUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated.");

    const { data: requester, error: requesterError } = await adminClient
      .from("profiles")
      .select("id, role, status, payroll_access")
      .eq("id", user.id)
      .single();

    if (requesterError) throw requesterError;

    const isActive = (requester.status || "active") === "active";
    const hasPayrollAccess = requester.role === "admin" || requester.payroll_access === true;
    if (!isActive || !hasPayrollAccess) {
      throw new Error("You do not have permission to manage payroll.");
    }

    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    const sourceType = String(body.source_type || "");
    const sourceId = String(body.source_id || "");
    const reason = String(body.reason || "").trim();
    const config = sourceConfig[sourceType];

    if (!["approve", "deny"].includes(action)) throw new Error("Invalid payroll action.");
    if (!config || !sourceId) throw new Error("Invalid payroll submission.");
    if (action === "deny" && !reason) throw new Error("A denial reason is required.");

    const { data: record, error: recordError } = await adminClient
      .from(config.table)
      .select("*")
      .eq("id", sourceId)
      .single();

    if (recordError || !record) throw recordError || new Error("Payroll submission not found.");
    if (record.user_id && record.user_id === user.id) {
      throw new Error("You cannot approve or deny your own payroll submission.");
    }

    const status = action === "approve" ? "Approved" : "Denied";
    const extendedPayload = action === "approve"
      ? { status, denial_reason: null, denied_at: null, denied_by: null }
      : { status, denial_reason: reason, denied_at: new Date().toISOString(), denied_by: user.id };

    let { error: updateError } = await adminClient
      .from(config.table)
      .update(extendedPayload)
      .eq("id", sourceId);

    if (updateError && /denial_reason|denied_at|denied_by|column/i.test(updateError.message || "")) {
      const retry = await adminClient
        .from(config.table)
        .update({ status })
        .eq("id", sourceId);
      updateError = retry.error;
    }

    if (updateError) throw updateError;

    if (action === "approve") {
      return jsonResponse({ success: true, action, status, source_type: sourceType, source_id: sourceId });
    }

    let submitterEmail = "";
    let submitterName = String(record[config.nameField] || "Team Member");

    if (record.user_id) {
      const { data: submitterProfile } = await adminClient
        .from("profiles")
        .select("email, full_name")
        .eq("id", record.user_id)
        .maybeSingle();

      submitterEmail = submitterProfile?.email || "";
      submitterName = submitterProfile?.full_name || submitterName;
    }

    if (!submitterEmail || !resendApiKey) {
      return jsonResponse({
        success: true,
        action,
        status,
        source_type: sourceType,
        source_id: sourceId,
        email_sent: false,
        email_error: !submitterEmail
          ? "The submitter email could not be found."
          : "The Resend API key is not configured.",
      });
    }

    const details = sourceType === "equipment_hours"
      ? [record.equipment_name, record[config.detailsField]].filter(Boolean).join(" — ")
      : String(record[config.detailsField] || "");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [submitterEmail],
        subject: `Payroll submission denied — ${config.label} on ${record[config.dateField] || ""}`,
        html: denialEmail({
          displayName: submitterName,
          type: config.label,
          date: String(record[config.dateField] || ""),
          details,
          amount: config.amount(record),
          notes: String(record.notes || ""),
          reason,
          appUrl,
        }),
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      return jsonResponse({
        success: true,
        action,
        status,
        source_type: sourceType,
        source_id: sourceId,
        email_sent: false,
        email_error: JSON.stringify(emailResult),
      });
    }

    return jsonResponse({
      success: true,
      action,
      status,
      source_type: sourceType,
      source_id: sourceId,
      email_sent: true,
      email_id: emailResult.id,
      recipient: submitterEmail,
    });
  } catch (error) {
    console.error("Payroll entry action error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, 400);
  }
});
