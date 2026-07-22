const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const route = getFunctionRoute(url.pathname);

    if (request.method === "GET" && route.length === 0) {
      return jsonResponse({ service: "auth", success: true }, 200);
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed." }, 405);
    }

    if (route[0] === "password") {
      const payload = await readJsonBody(request);
      return jsonResponse(authenticateDashboardPassword(payload), 200);
    }

    if (route[0] === "signin") {
      return jsonResponse({ success: false, error: "Username login is disabled." }, 410);
    }

    if (route[0] === "signup") {
      return jsonResponse({ success: false, error: "Signup is disabled." }, 410);
    }

    return jsonResponse({ success: false, error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth request failed.";
    const status = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    console.error("[auth]", error);
    return jsonResponse({ success: false, error: message }, status);
  }
});

function authenticateDashboardPassword({ password }: any) {
  const configuredPassword = String(Deno.env.get("ADMIN_DASHBOARD_PASSWORD") || "");
  const submittedPassword = String(password || "");

  if (!configuredPassword) {
    throw statusError("Dashboard password is not configured.", 503);
  }

  if (!submittedPassword || !secureCompare(submittedPassword, configuredPassword)) {
    throw statusError("Invalid dashboard password.", 401);
  }

  return {
    session: {
      name: Deno.env.get("ADMIN_DASHBOARD_NAME") || "Dashboard Admin",
      role: "admin",
      username: "dashboard-admin"
    },
    success: true
  };
}

function secureCompare(left: string, right: string) {
  const leftText = String(left);
  const rightText = String(right);
  const maxLength = Math.max(leftText.length, rightText.length);
  let diff = leftText.length === rightText.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftText.charCodeAt(index) || 0) ^ (rightText.charCodeAt(index) || 0);
  }

  return diff === 0;
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw statusError("Request body must be valid JSON.", 400);
  }
}

function getFunctionRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const functionIndex = parts.indexOf("auth");

  return functionIndex === -1 ? [] : parts.slice(functionIndex + 1);
}

function statusError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}
