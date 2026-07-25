import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const classroomScopes = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
];

type StatePayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  scope?: string;
  expires_at?: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createState(secret: string, userId: string): Promise<string> {
  const now = Date.now();
  const payload: StatePayload = {
    userId,
    issuedAt: now,
    expiresAt: now + 10 * 60 * 1000,
    nonce: crypto.randomUUID(),
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyState(secret: string, state: string): Promise<StatePayload> {
  const [body, signature] = state.split(".");
  if (!body || !signature) throw new Error("The Google connection request is invalid.");
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature),
    encoder.encode(body),
  );
  if (!valid) throw new Error("The Google connection request could not be verified.");
  const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as StatePayload;
  if (!payload.userId || payload.expiresAt < Date.now()) {
    throw new Error("The Google connection request expired. Start the connection again.");
  }
  return payload;
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`jammin-google-classroom:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptTokens(secret: string, tokens: StoredTokens): Promise<string> {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(tokens)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptTokens(secret: string, ciphertext: string): Promise<StoredTokens> {
  const [ivPart, dataPart] = ciphertext.split(".");
  if (!ivPart || !dataPart) throw new Error("The saved Google authorization is invalid.");
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return JSON.parse(decoder.decode(decrypted)) as StoredTokens;
}

function redirectToCommandCenter(appUrl: string, result: "connected" | "error", message?: string) {
  const url = new URL(appUrl);
  url.searchParams.set("classroom", result);
  if (message) url.searchParams.set("classroom_message", message);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const projectUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("PROJECT_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_CLASSROOM_REDIRECT_URI");
  const appUrl = Deno.env.get("COMMAND_CENTER_URL") || "https://jdjcommand.myjammindjs.com";
  const allowedDomain = (Deno.env.get("GOOGLE_CLASSROOM_ALLOWED_DOMAIN") || "myjammindjs.com").toLowerCase();

  if (!projectUrl || !anonKey || !serviceKey || !clientId || !clientSecret || !redirectUri) {
    return jsonResponse({ error: "Google Classroom or Supabase server settings are incomplete." }, 500);
  }

  const adminClient = createClient(projectUrl, serviceKey);

  try {
    if (req.method === "POST") {
      const authorization = req.headers.get("Authorization") || "";
      const userClient = createClient(projectUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) throw new Error("Your Command Center session has expired. Sign in again.");

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile || !["admin", "manager"].includes(profile.role)) {
        throw new Error("Only administrators and managers can connect Google Classroom.");
      }

      const body = await req.json().catch(() => ({}));
      if (body.action !== "start") throw new Error("Unknown Google Classroom authorization action.");

      const state = await createState(clientSecret, user.id);
      const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorizationUrl.searchParams.set("client_id", clientId);
      authorizationUrl.searchParams.set("redirect_uri", redirectUri);
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set("scope", classroomScopes.join(" "));
      authorizationUrl.searchParams.set("access_type", "offline");
      authorizationUrl.searchParams.set("prompt", "consent");
      authorizationUrl.searchParams.set("include_granted_scopes", "true");
      authorizationUrl.searchParams.set("state", state);
      authorizationUrl.searchParams.set("login_hint", profile.email || "");
      authorizationUrl.searchParams.set("hd", allowedDomain);

      return jsonResponse({ authorization_url: authorizationUrl.toString() });
    }

    if (req.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);

    const requestUrl = new URL(req.url);
    const googleError = requestUrl.searchParams.get("error");
    const googleErrorDescription = requestUrl.searchParams.get("error_description");
    if (googleError) {
      return redirectToCommandCenter(appUrl, "error", googleErrorDescription || googleError);
    }

    const code = requestUrl.searchParams.get("code");
    const stateValue = requestUrl.searchParams.get("state");
    if (!code || !stateValue) throw new Error("Google did not return the required connection information.");

    const state = await verifyState(clientSecret, stateValue);
    const { data: requester, error: requesterError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", state.userId)
      .single();
    if (requesterError) throw requesterError;
    if (!requester || !["admin", "manager"].includes(requester.role)) {
      throw new Error("The Command Center user who started this connection is no longer authorized.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData?.error_description || tokenData?.error || "Google rejected the authorization code.");
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo?.email) {
      throw new Error("The connected Google account email could not be verified.");
    }
    if (!String(userInfo.email).toLowerCase().endsWith(`@${allowedDomain}`)) {
      throw new Error(`Connect the ${allowedDomain} account that owns the JAMMIN Classroom.`);
    }

    const { data: existingConnection } = await adminClient
      .from("google_classroom_connections")
      .select("token_ciphertext, course_id, course_name, course_section, course_link, created_at")
      .eq("id", "primary")
      .maybeSingle();

    let existingTokens: Partial<StoredTokens> = {};
    if (existingConnection?.token_ciphertext) {
      try {
        existingTokens = await decryptTokens(clientSecret, existingConnection.token_ciphertext);
      } catch (error) {
        console.warn("Existing Classroom token could not be reused:", error);
      }
    }

    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString();
    const tokens: StoredTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || existingTokens.refresh_token || "",
      token_type: tokenData.token_type || "Bearer",
      scope: tokenData.scope || classroomScopes.join(" "),
      expires_at: expiresAt,
    };
    if (!tokens.refresh_token) {
      throw new Error("Google did not provide an offline connection token. Disconnect the app in Google and connect again.");
    }

    const tokenCiphertext = await encryptTokens(clientSecret, tokens);
    const { error: saveError } = await adminClient
      .from("google_classroom_connections")
      .upsert({
        id: "primary",
        authorized_email: String(userInfo.email).toLowerCase(),
        authorized_name: userInfo.name || requester.full_name || userInfo.email,
        connected_by_user_id: requester.id,
        token_ciphertext: tokenCiphertext,
        token_expires_at: expiresAt,
        granted_scopes: String(tokenData.scope || classroomScopes.join(" ")).split(" ").filter(Boolean),
        course_id: existingConnection?.course_id || null,
        course_name: existingConnection?.course_name || null,
        course_section: existingConnection?.course_section || null,
        course_link: existingConnection?.course_link || null,
        status: "connected",
        last_sync_error: null,
        created_at: existingConnection?.created_at || new Date().toISOString(),
      }, { onConflict: "id" });
    if (saveError) throw saveError;

    return redirectToCommandCenter(appUrl, "connected");
  } catch (error) {
    console.error("Google Classroom authorization error:", error);
    if (req.method === "GET") {
      return redirectToCommandCenter(appUrl, "error", error?.message || "Google Classroom could not be connected.");
    }
    return jsonResponse({ error: error?.message || "Google Classroom could not be connected." }, 400);
  }
});
