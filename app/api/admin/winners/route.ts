import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type UpdateWinnerBody = {
  winner_id?: unknown;
  action?: unknown;
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

function getServiceDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      ),
      db: null,
    };
  }

  return {
    db: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    error: null,
  };
}

export async function GET() {
  try {
    const { db, error } = getServiceDb();
    if (error || !db) {
      return error;
    }

    const { data, error: fetchError } = await db
      .from("winners")
      .select(
        "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url, draws(draw_date)",
      )
      .order("id", { ascending: false })
      .limit(200);

    if (fetchError) {
      return jsonError("Failed to fetch winners.", 500, fetchError.message);
    }

    const winners = (data ?? []).map((row) => {
      const drawsValue =
        row.draws && Array.isArray(row.draws) ? row.draws[0] : row.draws;

      return {
        id: row.id,
        user_id: row.user_id,
        draw_id: row.draw_id,
        match_type: row.match_type,
        prize_amount: row.prize_amount,
        payment_status: row.payment_status,
        proof_image_url: row.proof_image_url,
        draw_date: drawsValue?.draw_date ?? null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        winners,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError("Unexpected error while fetching winners.", 500, message);
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, error } = getServiceDb();
    if (error || !db) {
      return error;
    }

    let body: UpdateWinnerBody = {};
    try {
      body = (await request.json()) as UpdateWinnerBody;
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const winnerId =
      typeof body.winner_id === "string" && body.winner_id.trim().length > 0
        ? body.winner_id.trim()
        : null;
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!winnerId) {
      return jsonError("winner_id is required.", 400);
    }

    if (action !== "mark_paid") {
      return jsonError("action must be 'mark_paid'.", 400);
    }

    const { data: winner, error: lookupError } = await db
      .from("winners")
      .select("id, payment_status, proof_image_url")
      .eq("id", winnerId)
      .single();

    if (lookupError || !winner) {
      return jsonError("Winner not found.", 404, lookupError?.message);
    }

    if (winner.payment_status === "paid") {
      return NextResponse.json(
        {
          success: true,
          message: "Winner is already marked as paid.",
        },
        { status: 200 },
      );
    }

    if (!winner.proof_image_url) {
      return jsonError("Cannot complete payout before proof is uploaded.", 400);
    }

    const { error: updateError } = await db
      .from("winners")
      .update({ payment_status: "paid" })
      .eq("id", winnerId);

    if (updateError) {
      return jsonError(
        "Failed to mark payout as completed.",
        500,
        updateError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Payout marked as completed.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while updating winner payout.",
      500,
      message,
    );
  }
}
