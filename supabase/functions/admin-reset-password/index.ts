import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const PROJECT_ANON_KEY = Deno.env.get("PROJECT_ANON_KEY");
    const PROJECT_SERVICE_ROLE_KEY = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");

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
    if (requesterProfile?.role !== "admin") throw new Error("Only admins can reset passwords.");

    const body = await req.json();
    const user_id = body.user_id;
    const password = body.password;

    if (!user_id || !password || password.length < 6) {
      throw new Error("User ID and a password of at least 6 characters are required.");
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
