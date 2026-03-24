import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type WinnerTier = 3 | 4 | 5;

type ScoreRow = {
  user_id: string;
  score: number;
  date_played: string | null;
  created_at: string | null;
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

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function getCurrentMonthRangeUtc() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );

  return {
    nowIso: now.toISOString(),
    monthStartIso: monthStart.toISOString(),
    nextMonthStartIso: nextMonthStart.toISOString(),
  };
}

function generateUniqueDrawNumbers(
  total: number,
  min: number,
  max: number,
): number[] {
  const values = new Set<number>();

  while (values.size < total) {
    values.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  return Array.from(values).sort((a, b) => a - b);
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

    const { nowIso, monthStartIso, nextMonthStartIso } =
      getCurrentMonthRangeUtc();

    const { data: existingSimulatedDraws, error: drawLookupError } =
      await serviceDb
        .from("draws")
        .select("id")
        .eq("status", "simulated")
        .gte("draw_date", monthStartIso)
        .lt("draw_date", nextMonthStartIso);

    if (drawLookupError) {
      return jsonError(
        "Failed to check existing simulated draw for this month.",
        500,
        drawLookupError.message,
      );
    }

    const existingDrawIds = (existingSimulatedDraws ?? []).map(
      (row) => row.id as string,
    );

    if (existingDrawIds.length > 0) {
      const { error: deleteWinnersError } = await serviceDb
        .from("winners")
        .delete()
        .in("draw_id", existingDrawIds);

      if (deleteWinnersError) {
        return jsonError(
          "Failed to delete winners for existing simulated draw.",
          500,
          deleteWinnersError.message,
        );
      }

      const { error: deleteDrawsError } = await serviceDb
        .from("draws")
        .delete()
        .in("id", existingDrawIds);

      if (deleteDrawsError) {
        return jsonError(
          "Failed to delete existing simulated draw.",
          500,
          deleteDrawsError.message,
        );
      }
    }

    const winningNumbers = generateUniqueDrawNumbers(5, 1, 45);
    const winningSet = new Set(winningNumbers);

    const { data: activeSubscriptions, error: activeSubsError } =
      await serviceDb
        .from("subscriptions")
        .select("user_id")
        .eq("status", "active");

    if (activeSubsError) {
      return jsonError(
        "Failed to fetch active subscriptions.",
        500,
        activeSubsError.message,
      );
    }

    const activeUserIds = Array.from(
      new Set(
        (activeSubscriptions ?? [])
          .map((row) => row.user_id as string | null)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const { data: settingsRow, error: settingsError } = await serviceDb
      .from("system_settings")
      .select("id, current_jackpot_rollover")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      return jsonError(
        "Failed to fetch system settings.",
        500,
        settingsError.message,
      );
    }

    const currentRollover = toMoney(
      Number(settingsRow?.current_jackpot_rollover ?? 0),
    );

    const monthlySubscriptionPrice = 10;
    const prizePoolPercent = 0.5;

    const totalPool = toMoney(
      activeUserIds.length * monthlySubscriptionPrice * prizePoolPercent +
        currentRollover,
    );

    const tierPool5 = toMoney(totalPool * 0.4);
    const tierPool4 = toMoney(totalPool * 0.35);
    const tierPool3 = toMoney(totalPool * 0.25);

    const winnersByTier: Record<WinnerTier, string[]> = {
      3: [],
      4: [],
      5: [],
    };

    if (activeUserIds.length > 0) {
      const { data: scoreRows, error: scoreError } = await serviceDb
        .from("scores")
        .select("user_id, score, date_played, created_at")
        .in("user_id", activeUserIds)
        .order("user_id", { ascending: true })
        .order("date_played", { ascending: false })
        .order("created_at", { ascending: false });

      if (scoreError) {
        return jsonError("Failed to fetch scores.", 500, scoreError.message);
      }

      const latestFiveByUser = new Map<string, ScoreRow[]>();
      for (const row of (scoreRows ?? []) as ScoreRow[]) {
        const list = latestFiveByUser.get(row.user_id) ?? [];
        if (list.length < 5) {
          list.push(row);
          latestFiveByUser.set(row.user_id, list);
        }
      }

      for (const userId of activeUserIds) {
        const latestFive = latestFiveByUser.get(userId) ?? [];
        const userNumbers = Array.from(
          new Set(latestFive.map((row) => row.score)),
        );

        const matchCount = userNumbers.reduce((count, number) => {
          return winningSet.has(number) ? count + 1 : count;
        }, 0);

        if (matchCount === 3 || matchCount === 4 || matchCount === 5) {
          winnersByTier[matchCount].push(userId);
        }
      }
    }

    const prizeEach5 =
      winnersByTier[5].length > 0
        ? toMoney(tierPool5 / winnersByTier[5].length)
        : 0;
    const prizeEach4 =
      winnersByTier[4].length > 0
        ? toMoney(tierPool4 / winnersByTier[4].length)
        : 0;
    const prizeEach3 =
      winnersByTier[3].length > 0
        ? toMoney(tierPool3 / winnersByTier[3].length)
        : 0;

    const rolloverAmountGenerated =
      winnersByTier[5].length === 0 ? tierPool5 : 0;

    const { data: insertedDraw, error: drawInsertError } = await serviceDb
      .from("draws")
      .insert({
        draw_date: nowIso,
        status: "simulated",
        winning_numbers: winningNumbers,
        total_prize_pool: totalPool,
        rollover_amount_generated: rolloverAmountGenerated,
        jackpot_amount: 0,
      })
      .select(
        "id, draw_date, status, winning_numbers, total_prize_pool, rollover_amount_generated",
      )
      .single();

    if (drawInsertError || !insertedDraw) {
      return jsonError(
        "Failed to insert simulated draw.",
        500,
        drawInsertError?.message,
      );
    }

    const winnersToInsert = [
      ...winnersByTier[5].map((userId) => ({
        draw_id: insertedDraw.id,
        user_id: userId,
        match_type: 5,
        prize_amount: prizeEach5,
        payment_status: "pending" as const,
      })),
      ...winnersByTier[4].map((userId) => ({
        draw_id: insertedDraw.id,
        user_id: userId,
        match_type: 4,
        prize_amount: prizeEach4,
        payment_status: "pending" as const,
      })),
      ...winnersByTier[3].map((userId) => ({
        draw_id: insertedDraw.id,
        user_id: userId,
        match_type: 3,
        prize_amount: prizeEach3,
        payment_status: "pending" as const,
      })),
    ];

    if (winnersToInsert.length > 0) {
      const { error: winnersInsertError } = await serviceDb
        .from("winners")
        .insert(winnersToInsert);

      if (winnersInsertError) {
        await serviceDb.from("draws").delete().eq("id", insertedDraw.id);
        return jsonError(
          "Failed to insert winners.",
          500,
          winnersInsertError.message,
        );
      }
    }

    const { error: settingsUpsertError } = await serviceDb
      .from("system_settings")
      .upsert(
        {
          id: 1,
          current_jackpot_rollover: rolloverAmountGenerated,
        },
        { onConflict: "id" },
      );

    if (settingsUpsertError) {
      return jsonError(
        "Simulation created but failed to update system settings rollover.",
        500,
        settingsUpsertError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        draw: insertedDraw,
        summary: {
          winning_numbers: winningNumbers,
          total_pool: totalPool,
          winners_count: {
            match_5: winnersByTier[5].length,
            match_4: winnersByTier[4].length,
            match_3: winnersByTier[3].length,
          },
          tier_pools: {
            match_5: tierPool5,
            match_4: tierPool4,
            match_3: tierPool3,
          },
          payouts_each: {
            match_5: prizeEach5,
            match_4: prizeEach4,
            match_3: prizeEach3,
          },
          rollover: {
            previous: currentRollover,
            generated: rolloverAmountGenerated,
            next: rolloverAmountGenerated,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while simulating monthly draw.",
      500,
      message,
    );
  }
}
