import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  scope?: string;
  expires_at?: string;
};

type Requester = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

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
  if (!ivPart || !dataPart) throw new Error("The saved Google Classroom connection is invalid.");
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return JSON.parse(decoder.decode(decrypted)) as StoredTokens;
}

function requireManager(requester: Requester) {
  if (!["admin", "manager"].includes(requester.role)) {
    throw new Error("Only administrators and managers can manage Google Classroom.");
  }
}

function googleDate(value: any): string | null {
  if (!value?.year || !value?.month || !value?.day) return null;
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function googleTime(value: any): string | null {
  if (!value) return null;
  const hour = Number(value.hours || 0);
  const minute = Number(value.minutes || 0);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function submissionLabel(state: string | null | undefined) {
  if (state === "RETURNED") return "Complete";
  if (state === "TURNED_IN") return "Submitted";
  if (state === "RECLAIMED_BY_STUDENT") return "Needs attention";
  return "Not started";
}

async function insertChunks(client: any, table: string, rows: any[], chunkSize = 300) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await client.from(table).insert(rows.slice(index, index + chunkSize));
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const projectUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("PROJECT_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET");

  if (!projectUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return jsonResponse({ error: "Google Classroom or Supabase server settings are incomplete." }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  const userClient = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(projectUrl, serviceKey);

  try {
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Your Command Center session has expired. Sign in again.");

    const { data: requester, error: requesterError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .single();
    if (requesterError) throw requesterError;
    if (!requester) throw new Error("Your Command Center profile could not be found.");

    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    const loadConnection = async () => {
      const { data: connection, error } = await adminClient
        .from("google_classroom_connections")
        .select("*")
        .eq("id", "primary")
        .maybeSingle();
      if (error) throw error;
      return connection;
    };

    const validGoogleConnection = async () => {
      const connection = await loadConnection();
      if (!connection || connection.status === "disconnected") {
        throw new Error("Google Classroom has not been connected yet.");
      }

      let tokens = await decryptTokens(clientSecret, connection.token_ciphertext);
      const expiresAt = new Date(tokens.expires_at || connection.token_expires_at || 0).getTime();
      if (!tokens.access_token || !expiresAt || expiresAt < Date.now() + 90_000) {
        if (!tokens.refresh_token) throw new Error("The Google Classroom connection needs to be reconnected.");
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokens.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResponse.json();
        if (!refreshResponse.ok) {
          throw new Error(refreshData?.error_description || "Google requires the Classroom account to be reconnected.");
        }
        const refreshedExpiresAt = new Date(Date.now() + Number(refreshData.expires_in || 3600) * 1000).toISOString();
        tokens = {
          ...tokens,
          access_token: refreshData.access_token,
          token_type: refreshData.token_type || tokens.token_type || "Bearer",
          scope: refreshData.scope || tokens.scope,
          expires_at: refreshedExpiresAt,
        };
        const tokenCiphertext = await encryptTokens(clientSecret, tokens);
        const { error: tokenSaveError } = await adminClient
          .from("google_classroom_connections")
          .update({ token_ciphertext: tokenCiphertext, token_expires_at: refreshedExpiresAt, status: "connected" })
          .eq("id", "primary");
        if (tokenSaveError) throw tokenSaveError;
      }

      return { connection, tokens };
    };

    const googleGet = async (path: string, params: Record<string, string> = {}) => {
      const { tokens } = await validGoogleConnection();
      const url = new URL(`https://classroom.googleapis.com/v1${path}`);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "Google Classroom rejected the request.");
      }
      return data;
    };

    const pagedGoogleList = async (
      path: string,
      responseKey: string,
      params: Record<string, string> = {},
    ) => {
      const rows: any[] = [];
      let pageToken = "";
      do {
        const data = await googleGet(path, {
          ...params,
          pageSize: params.pageSize || "100",
          ...(pageToken ? { pageToken } : {}),
        });
        rows.push(...(data?.[responseKey] || []));
        pageToken = data?.nextPageToken || "";
      } while (pageToken);
      return rows;
    };

    if (action === "my_training") {
      const connection = await loadConnection();
      if (!connection || connection.status === "disconnected" || !connection.course_id) {
        return jsonResponse({ connected: false });
      }

      const { data: student, error: studentError } = await adminClient
        .from("google_classroom_students")
        .select("id, email, full_name, google_user_id")
        .eq("connection_id", "primary")
        .eq("course_id", connection.course_id)
        .eq("profile_id", requester.id)
        .eq("active", true)
        .maybeSingle();
      if (studentError) throw studentError;
      if (!student) {
        return jsonResponse({
          connected: true,
          matched: false,
          course_name: connection.course_name,
          course_url: connection.course_link,
          last_synced_at: connection.last_synced_at,
        });
      }

      const [{ data: items, error: itemsError }, { data: submissions, error: submissionsError }, { data: topics, error: topicsError }] = await Promise.all([
        adminClient
          .from("google_classroom_items")
          .select("*")
          .eq("connection_id", "primary")
          .eq("course_id", connection.course_id)
          .eq("active", true),
        adminClient
          .from("google_classroom_submissions")
          .select("*")
          .eq("connection_id", "primary")
          .eq("course_id", connection.course_id)
          .eq("classroom_student_id", student.id),
        adminClient
          .from("google_classroom_topics")
          .select("google_topic_id, name, sort_order")
          .eq("connection_id", "primary")
          .eq("course_id", connection.course_id),
      ]);
      if (itemsError) throw itemsError;
      if (submissionsError) throw submissionsError;
      if (topicsError) throw topicsError;

      const topicMap = new Map((topics || []).map((topic: any) => [topic.google_topic_id, topic]));
      const submissionMap = new Map((submissions || []).map((submission: any) => [submission.classroom_item_id, submission]));
      const taskRows = (items || []).map((item: any) => {
        const submission = submissionMap.get(item.id);
        const status = item.item_type === "material" ? "Available" : submissionLabel(submission?.state);
        return {
          id: item.id,
          type: item.item_type,
          title: item.title,
          description: item.description,
          topic: topicMap.get(item.google_topic_id)?.name || null,
          topic_order: topicMap.get(item.google_topic_id)?.sort_order ?? 9999,
          due_date: item.due_date,
          status,
          late: Boolean(submission?.late),
          assigned_grade: submission?.assigned_grade ?? null,
          max_points: item.max_points ?? null,
          url: submission?.alternate_link || item.alternate_link || connection.course_link,
          updated_at: submission?.update_time || item.update_time || item.created_at,
        };
      }).sort((a: any, b: any) => {
        if (a.topic_order !== b.topic_order) return a.topic_order - b.topic_order;
        const aDue = a.due_date || "9999-12-31";
        const bDue = b.due_date || "9999-12-31";
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return a.title.localeCompare(b.title);
      });

      const assignments = taskRows.filter((item: any) => item.type === "coursework");
      const completed = assignments.filter((item: any) => item.status === "Complete").length;
      const submitted = assignments.filter((item: any) => item.status === "Submitted").length;
      const nextTask = assignments.find((item: any) => ["Not started", "Needs attention"].includes(item.status))
        || assignments.find((item: any) => item.status === "Submitted")
        || taskRows.find((item: any) => item.type === "material")
        || null;

      return jsonResponse({
        connected: true,
        matched: true,
        classroom_email: student.email,
        course_name: connection.course_name,
        course_url: connection.course_link,
        last_synced_at: connection.last_synced_at,
        progress: {
          completed,
          submitted,
          total: assignments.length,
          percent: assignments.length ? Math.round((completed / assignments.length) * 100) : 0,
        },
        next_task: nextTask,
        items: taskRows,
      });
    }

    requireManager(requester as Requester);

    if (action === "status") {
      const connection = await loadConnection();
      if (!connection) return jsonResponse({ connected: false });
      const [studentCount, matchedCount, itemCount] = await Promise.all([
        adminClient.from("google_classroom_students").select("id", { count: "exact", head: true }).eq("connection_id", "primary").eq("active", true),
        adminClient.from("google_classroom_students").select("id", { count: "exact", head: true }).eq("connection_id", "primary").eq("active", true).not("profile_id", "is", null),
        adminClient.from("google_classroom_items").select("id", { count: "exact", head: true }).eq("connection_id", "primary").eq("active", true),
      ]);
      return jsonResponse({
        connected: connection.status !== "disconnected",
        authorized_email: connection.authorized_email,
        authorized_name: connection.authorized_name,
        status: connection.status,
        course_id: connection.course_id,
        course_name: connection.course_name,
        course_section: connection.course_section,
        course_url: connection.course_link,
        last_synced_at: connection.last_synced_at,
        last_sync_error: connection.last_sync_error,
        students: studentCount.count || 0,
        matched_students: matchedCount.count || 0,
        items: itemCount.count || 0,
      });
    }

    if (action === "courses") {
      await validGoogleConnection();
      const courses = await pagedGoogleList("/courses", "courses", { teacherId: "me" });
      return jsonResponse({
        courses: courses
          .filter((course: any) => course.courseState !== "DECLINED")
          .map((course: any) => ({
            id: course.id,
            name: course.name,
            section: course.section || "",
            description: course.descriptionHeading || course.description || "",
            state: course.courseState,
            alternate_link: course.alternateLink,
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name)),
      });
    }

    if (action === "select_course") {
      const courseId = String(body.course_id || "").trim();
      if (!courseId) throw new Error("Choose a Google Classroom course first.");
      const course = await googleGet(`/courses/${encodeURIComponent(courseId)}`);
      const { error } = await adminClient
        .from("google_classroom_connections")
        .update({
          course_id: course.id,
          course_name: course.name,
          course_section: course.section || null,
          course_link: course.alternateLink || null,
          status: "connected",
          last_sync_error: null,
        })
        .eq("id", "primary");
      if (error) throw error;
      return jsonResponse({ success: true, course });
    }

    if (action === "students") {
      const connection = await loadConnection();
      if (!connection?.course_id) throw new Error("Select a Google Classroom course first.");
      const [{ data: students, error: studentError }, { data: profiles, error: profileError }] = await Promise.all([
        adminClient
          .from("google_classroom_students")
          .select("id, google_user_id, email, full_name, photo_url, profile_id, match_method, active")
          .eq("connection_id", "primary")
          .eq("course_id", connection.course_id)
          .order("full_name", { ascending: true }),
        adminClient
          .from("profiles")
          .select("id, full_name, email, role, status")
          .neq("status", "disabled")
          .order("full_name", { ascending: true }),
      ]);
      if (studentError) throw studentError;
      if (profileError) throw profileError;
      return jsonResponse({ students: students || [], profiles: profiles || [] });
    }

    if (action === "match_student") {
      const studentId = String(body.student_id || "").trim();
      const profileId = body.profile_id ? String(body.profile_id) : null;
      if (!studentId) throw new Error("The Classroom student was not identified.");
      const { error } = await adminClient
        .from("google_classroom_students")
        .update({ profile_id: profileId, match_method: profileId ? "manual" : null })
        .eq("id", studentId);
      if (error) {
        if (/duplicate key|unique/i.test(error.message || "")) {
          throw new Error("That Command Center profile is already matched to another Classroom account.");
        }
        throw error;
      }
      return jsonResponse({ success: true });
    }

    if (action === "disconnect") {
      if (requester.role !== "admin") throw new Error("Only an administrator can disconnect Google Classroom.");
      const { error } = await adminClient
        .from("google_classroom_connections")
        .delete()
        .eq("id", "primary");
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action !== "sync") throw new Error("Unknown Google Classroom action.");

    const { connection } = await validGoogleConnection();
    if (!connection.course_id) throw new Error("Select a Google Classroom course before synchronizing.");
    const courseId = connection.course_id;

    await adminClient
      .from("google_classroom_connections")
      .update({ status: "syncing", last_sync_error: null })
      .eq("id", "primary");

    try {
      const [course, topics, courseWork, materials, students] = await Promise.all([
        googleGet(`/courses/${encodeURIComponent(courseId)}`),
        pagedGoogleList(`/courses/${encodeURIComponent(courseId)}/topics`, "topic", {}),
        pagedGoogleList(`/courses/${encodeURIComponent(courseId)}/courseWork`, "courseWork", {}),
        pagedGoogleList(`/courses/${encodeURIComponent(courseId)}/courseWorkMaterials`, "courseWorkMaterial", {}),
        pagedGoogleList(`/courses/${encodeURIComponent(courseId)}/students`, "students", {}),
      ]);

      await Promise.all([
        adminClient.from("google_classroom_students").update({ active: false }).eq("connection_id", "primary").eq("course_id", courseId),
        adminClient.from("google_classroom_items").update({ active: false }).eq("connection_id", "primary").eq("course_id", courseId),
      ]);

      const topicRows = topics.map((topic: any, index: number) => ({
        connection_id: "primary",
        course_id: courseId,
        google_topic_id: topic.topicId,
        name: topic.name,
        sort_order: index + 1,
      }));
      if (topicRows.length) {
        const { error } = await adminClient
          .from("google_classroom_topics")
          .upsert(topicRows, { onConflict: "connection_id,course_id,google_topic_id" });
        if (error) throw error;
      }

      const itemRows = [
        ...courseWork.map((item: any) => ({
          connection_id: "primary",
          course_id: courseId,
          item_type: "coursework",
          google_item_id: item.id,
          google_topic_id: item.topicId || null,
          title: item.title,
          description: item.description || null,
          state: item.state || null,
          work_type: item.workType || null,
          alternate_link: item.alternateLink || null,
          due_date: googleDate(item.dueDate),
          due_time: googleTime(item.dueTime),
          max_points: item.maxPoints ?? null,
          materials: item.materials || [],
          creation_time: item.creationTime || null,
          update_time: item.updateTime || null,
          active: item.state !== "DELETED",
        })),
        ...materials.map((item: any) => ({
          connection_id: "primary",
          course_id: courseId,
          item_type: "material",
          google_item_id: item.id,
          google_topic_id: item.topicId || null,
          title: item.title,
          description: item.description || null,
          state: item.state || null,
          work_type: "MATERIAL",
          alternate_link: item.alternateLink || null,
          due_date: null,
          due_time: null,
          max_points: null,
          materials: item.materials || [],
          creation_time: item.creationTime || null,
          update_time: item.updateTime || null,
          active: item.state !== "DELETED",
        })),
      ];
      if (itemRows.length) {
        const { error } = await adminClient
          .from("google_classroom_items")
          .upsert(itemRows, { onConflict: "connection_id,course_id,item_type,google_item_id" });
        if (error) throw error;
      }

      const [{ data: existingStudents, error: existingStudentError }, { data: profiles, error: profileError }] = await Promise.all([
        adminClient
          .from("google_classroom_students")
          .select("google_user_id, profile_id, match_method")
          .eq("connection_id", "primary")
          .eq("course_id", courseId),
        adminClient
          .from("profiles")
          .select("id, email")
          .neq("status", "disabled"),
      ]);
      if (existingStudentError) throw existingStudentError;
      if (profileError) throw profileError;

      const existingMap = new Map((existingStudents || []).map((student: any) => [student.google_user_id, student]));
      const profileByEmail = new Map((profiles || []).filter((profile: any) => profile.email).map((profile: any) => [String(profile.email).toLowerCase(), profile.id]));
      const usedProfiles = new Set((existingStudents || []).filter((student: any) => student.profile_id).map((student: any) => student.profile_id));
      const studentRows = students.map((student: any) => {
        const existing = existingMap.get(student.userId);
        const email = student.profile?.emailAddress ? String(student.profile.emailAddress).toLowerCase() : null;
        let profileId = existing?.profile_id || null;
        let matchMethod = existing?.match_method || null;
        if (!profileId && email) {
          const emailMatch = profileByEmail.get(email);
          if (emailMatch && !usedProfiles.has(emailMatch)) {
            profileId = emailMatch;
            matchMethod = "email";
            usedProfiles.add(emailMatch);
          }
        }
        return {
          connection_id: "primary",
          course_id: courseId,
          google_user_id: student.userId,
          email,
          full_name: student.profile?.name?.fullName || email || "Classroom student",
          photo_url: student.profile?.photoUrl || null,
          profile_id: profileId,
          match_method: matchMethod,
          active: true,
        };
      });
      if (studentRows.length) {
        const { error } = await adminClient
          .from("google_classroom_students")
          .upsert(studentRows, { onConflict: "connection_id,course_id,google_user_id" });
        if (error) throw error;
      }

      const [{ data: savedItems, error: savedItemError }, { data: savedStudents, error: savedStudentError }] = await Promise.all([
        adminClient
          .from("google_classroom_items")
          .select("id, google_item_id, item_type")
          .eq("connection_id", "primary")
          .eq("course_id", courseId),
        adminClient
          .from("google_classroom_students")
          .select("id, google_user_id")
          .eq("connection_id", "primary")
          .eq("course_id", courseId),
      ]);
      if (savedItemError) throw savedItemError;
      if (savedStudentError) throw savedStudentError;
      const itemMap = new Map((savedItems || []).filter((item: any) => item.item_type === "coursework").map((item: any) => [item.google_item_id, item.id]));
      const studentMap = new Map((savedStudents || []).map((student: any) => [student.google_user_id, student.id]));

      const submissionGroups = await Promise.all(courseWork.map(async (work: any) => {
        const submissions = await pagedGoogleList(
          `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(work.id)}/studentSubmissions`,
          "studentSubmissions",
          {},
        );
        return submissions.map((submission: any) => ({ work, submission }));
      }));

      const submissionRows = submissionGroups.flat().map(({ work, submission }: any) => {
        const classroomItemId = itemMap.get(work.id);
        const classroomStudentId = studentMap.get(submission.userId);
        if (!classroomItemId || !classroomStudentId) return null;
        return {
          connection_id: "primary",
          course_id: courseId,
          classroom_item_id: classroomItemId,
          classroom_student_id: classroomStudentId,
          google_submission_id: submission.id,
          state: submission.state || null,
          late: Boolean(submission.late),
          assigned_grade: submission.assignedGrade ?? null,
          draft_grade: submission.draftGrade ?? null,
          alternate_link: submission.alternateLink || work.alternateLink || null,
          creation_time: submission.creationTime || null,
          update_time: submission.updateTime || null,
        };
      }).filter(Boolean);

      const { error: clearSubmissionError } = await adminClient
        .from("google_classroom_submissions")
        .delete()
        .eq("connection_id", "primary")
        .eq("course_id", courseId);
      if (clearSubmissionError) throw clearSubmissionError;
      if (submissionRows.length) await insertChunks(adminClient, "google_classroom_submissions", submissionRows);

      const matchedStudents = studentRows.filter((student: any) => student.profile_id).length;
      const now = new Date().toISOString();
      const { error: connectionUpdateError } = await adminClient
        .from("google_classroom_connections")
        .update({
          course_name: course.name,
          course_section: course.section || null,
          course_link: course.alternateLink || null,
          status: "connected",
          last_synced_at: now,
          last_sync_error: null,
        })
        .eq("id", "primary");
      if (connectionUpdateError) throw connectionUpdateError;

      return jsonResponse({
        success: true,
        course_name: course.name,
        topics: topicRows.length,
        items: itemRows.filter((item: any) => item.active).length,
        students: studentRows.length,
        matched_students: matchedStudents,
        submissions: submissionRows.length,
        last_synced_at: now,
      });
    } catch (error) {
      await adminClient
        .from("google_classroom_connections")
        .update({ status: "error", last_sync_error: error?.message || String(error) })
        .eq("id", "primary");
      throw error;
    }
  } catch (error) {
    console.error("Google Classroom sync error:", error);
    return jsonResponse({ error: error?.message || "Google Classroom could not be synchronized." }, 400);
  }
});
