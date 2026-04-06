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

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRole) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    const serviceDb = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    const { data: charities, error: charitiesError } = await serviceDb
      .from("charities")
      .select("*")
      .order("name", { ascending: true });

    if (charitiesError) {
      return jsonError(
        "Failed to fetch charities data.",
        500,
        charitiesError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        users,
        draws: draws ?? [],
        charities: charities ?? [],
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
