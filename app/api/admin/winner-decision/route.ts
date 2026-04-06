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

type DecisionBody = {
  winner_id?: unknown;
  action?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
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

    const authedDb = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: adminCheck, error: adminCheckError } = await authedDb
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

    if (adminCheck?.role !== "admin") {
      return jsonError("Forbidden. Admin access is required.", 403);
    }

    let body: DecisionBody;
    try {
      body = (await request.json()) as DecisionBody;
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

    const { data: winner, error: winnerFetchError } = await authedDb
      .from("winners")
      .select(
        "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
      )
      .eq("id", winnerId)
      .single();

    if (winnerFetchError || !winner) {
      return jsonError(
        "Winner record not found.",
        404,
        winnerFetchError?.message,
      );
    }

    if (winner.payment_status !== "pending") {
      return jsonError(
        "Only winners with pending payment status can be reviewed.",
        400,
      );
    }

    if (action === "approve") {
      if (!winner.proof_image_url) {
        return jsonError(
          "Proof upload is required before approving a winner.",
          400,
        );
      }

      const { data: approvedWinner, error: approveError } = await authedDb
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

    const { data: rejectedWinner, error: rejectError } = await authedDb
      .from("winners")
      .update({
        proof_image_url: null,
        payment_status: "pending",
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
        message: "Proof rejected. Winner remains pending for re-submission.",
        winner: rejectedWinner,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while processing winner decision.",
      500,
      message,
    );
  }
}
