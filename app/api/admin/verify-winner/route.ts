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

type VerifyWinnerBody = {
  winner_id?: unknown;
  action?: unknown;
};

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

    // Service-role client bypasses RLS for admin moderation actions.
    const serviceDb = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: adminProfile, error: adminCheckError } = await serviceDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminCheckError) {
      return jsonError(
        "Failed to verify admin role.",
        500,
        adminCheckError.message,
      );
    }

    if (adminProfile?.role !== "admin") {
      return jsonError("Forbidden. Admin access is required.", 403);
    }

    let body: VerifyWinnerBody;
    try {
      body = (await request.json()) as VerifyWinnerBody;
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const winnerId =
      typeof body.winner_id === "string" ? body.winner_id.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!winnerId) {
      return jsonError("winner_id is required.", 400);
    }

    if (action !== "approve" && action !== "reject") {
      return jsonError("action must be 'approve' or 'reject'.", 400);
    }

    const { data: existingWinner, error: winnerLookupError } = await serviceDb
      .from("winners")
      .select(
        "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
      )
      .eq("id", winnerId)
      .single();

    if (winnerLookupError || !existingWinner) {
      return jsonError(
        "Winner record not found.",
        404,
        winnerLookupError?.message,
      );
    }

    if (action === "approve") {
      const { data: approvedWinner, error: approveError } = await serviceDb
        .from("winners")
        .update({ payment_status: "paid" })
        .eq("id", winnerId)
        .select(
          "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
        )
        .single();

      if (approveError || !approvedWinner) {
        return jsonError(
          "Failed to approve winner.",
          500,
          approveError?.message,
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Winner approved and marked as paid.",
          winner: approvedWinner,
        },
        { status: 200 },
      );
    }

    const { data: rejectedWinner, error: rejectError } = await serviceDb
      .from("winners")
      .update({
        payment_status: "pending",
        proof_image_url: null,
      })
      .eq("id", winnerId)
      .select(
        "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
      )
      .single();

    if (rejectError || !rejectedWinner) {
      return jsonError(
        "Failed to reject winner proof.",
        500,
        rejectError?.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Proof rejected. Winner remains pending so they can upload proof again.",
        winner: rejectedWinner,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while processing winner verification.",
      500,
      message,
    );
  }
}
