import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
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
      return jsonError("User is not authenticated.", 401, authError?.message);
    }

    // Use service-role client for admin operations to bypass RLS.
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
      return jsonError("Forbidden. Admin access is required.", 403);
    }

    const { data: simulatedDraw, error: drawFetchError } = await serviceDb
      .from("draws")
      .select(
        "id, status, draw_date, winning_numbers, total_prize_pool, rollover_amount_generated",
      )
      .eq("status", "simulated")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawFetchError) {
      return jsonError(
        "Failed to fetch simulated draw.",
        500,
        drawFetchError.message,
      );
    }

    if (!simulatedDraw) {
      return jsonError("No simulated draw found to publish.", 404);
    }

    const rolloverAmount = Number(simulatedDraw.rollover_amount_generated ?? 0);

    const { data: publishedDraw, error: publishError } = await serviceDb
      .from("draws")
      .update({ status: "published" })
      .eq("id", simulatedDraw.id)
      .select(
        "id, status, draw_date, winning_numbers, total_prize_pool, rollover_amount_generated",
      )
      .single();

    if (publishError || !publishedDraw) {
      return jsonError("Failed to publish draw.", 500, publishError?.message);
    }

    const { error: settingsError } = await serviceDb
      .from("system_settings")
      .upsert(
        {
          id: 1,
          current_jackpot_rollover: Number.isFinite(rolloverAmount)
            ? rolloverAmount
            : 0,
        },
        {
          onConflict: "id",
        },
      );

    if (settingsError) {
      return jsonError(
        "Draw published but failed to update system settings rollover.",
        500,
        settingsError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Draw published successfully.",
        draw: publishedDraw,
        rollover_applied_for_next_month: Number.isFinite(rolloverAmount)
          ? rolloverAmount
          : 0,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError("Unexpected error while publishing draw.", 500, message);
  }
}
