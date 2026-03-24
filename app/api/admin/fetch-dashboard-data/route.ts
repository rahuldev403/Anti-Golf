import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SubscriptionRow = {
  status: string | null;
  plan_type: string | null;
};

type CharityJoin =
  | {
      name?: string | null;
    }
  | Array<{
      name?: string | null;
    }>
  | null;

type UserRow = {
  id: string;
  role: string | null;
  created_at: string | null;
  selected_charity_id: string | null;
  charity_percentage: number | null;
  subscriptions?: SubscriptionRow[] | null;
  selected_charity?: CharityJoin;
};

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

function getSelectedCharityName(value: CharityJoin): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value.name ?? null;
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRole) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY), and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError("Missing or invalid Authorization header.", 401);
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      return jsonError("Missing bearer token.", 401);
    }

    const baseClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await baseClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonError("Unauthorized", 401, authError?.message);
    }

    const serviceDb = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userProfile, error: roleError } = await serviceDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) {
      return jsonError("Failed to verify admin role.", 500, roleError.message);
    }

    if (userProfile?.role !== "admin") {
      return jsonError("Unauthorized", 401);
    }

    const { data: usersData, error: usersError } = await serviceDb
      .from("users")
      .select(
        "id, role, created_at, selected_charity_id, charity_percentage, subscriptions(status, plan_type), selected_charity:charities(name)",
      )
      .order("created_at", { ascending: false });

    if (usersError) {
      return jsonError("Failed to fetch users data.", 500, usersError.message);
    }

    const users = ((usersData ?? []) as UserRow[]).map((row) => {
      const subscriptions = row.subscriptions ?? [];
      const isActive = subscriptions.some(
        (subscription) => subscription.status === "active",
      );

      return {
        id: row.id,
        role: row.role,
        created_at: row.created_at,
        selected_charity_id: row.selected_charity_id,
        selected_charity_name: getSelectedCharityName(
          row.selected_charity ?? null,
        ),
        charity_percentage: row.charity_percentage,
        subscription_status: isActive ? "active" : "inactive",
        subscriptions,
      };
    });

    const { data: draws, error: drawsError } = await serviceDb
      .from("draws")
      .select("*")
      .order("draw_date", { ascending: false });

    if (drawsError) {
      return jsonError("Failed to fetch draws data.", 500, drawsError.message);
    }

    return NextResponse.json(
      {
        success: true,
        users,
        draws: draws ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while fetching admin dashboard data.",
      500,
      message,
    );
  }
}
