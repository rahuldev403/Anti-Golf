import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type WinnerTier = 3 | 4 | 5;

type ScoreRow = {
  user_id: string;
  score: number;
  date_played: string | null;
  created_at: string | null;
};

type DeleteSimulatedDrawBody = {
  draw_id?: unknown;
};

type SimulateDrawBody = {
  draw_mode?: unknown;
  algorithm_weight?: unknown;
  random_selection_mode?: unknown;
  manual_numbers?: unknown;
};

type AlgorithmWeight = "most_frequent" | "least_frequent";
type RandomSelectionMode = "automated" | "manual";

const MONTHLY_SUBSCRIPTION_PRICE = 10;
const PRIZE_POOL_CONTRIBUTION_PORTION = 0.5;
const POOL_SHARE_MATCH_5 = 0.4;
const POOL_SHARE_MATCH_4 = 0.35;
const POOL_SHARE_MATCH_3 = 0.25;

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

function pickWeightedNumber(candidates: number[], weights: number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const randomPoint = Math.random() * totalWeight;
  let runningWeight = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    runningWeight += weights[index];
    if (randomPoint <= runningWeight) {
      return candidates[index];
    }
  }

  return candidates[candidates.length - 1];
}

function generateAlgorithmBasedDrawNumbers(
  scores: ScoreRow[],
  algorithmWeight: AlgorithmWeight,
): number[] {
  const frequencyMap = new Map<number, number>();

  for (const row of scores) {
    if (typeof row.score !== "number" || Number.isNaN(row.score)) {
      continue;
    }

    if (row.score < 1 || row.score > 45) {
      continue;
    }

    const current = frequencyMap.get(row.score) ?? 0;
    frequencyMap.set(row.score, current + 1);
  }

  const maxFrequency = Math.max(...Array.from(frequencyMap.values()), 0);
  const availableNumbers = Array.from({ length: 45 }, (_, index) => index + 1);
  const selectedNumbers: number[] = [];

  while (selectedNumbers.length < 5 && availableNumbers.length > 0) {
    const weights = availableNumbers.map((number) => {
      const frequency = frequencyMap.get(number) ?? 0;

      if (algorithmWeight === "most_frequent") {
        return frequency + 1;
      }

      return maxFrequency - frequency + 1;
    });

    const selected = pickWeightedNumber(availableNumbers, weights);
    selectedNumbers.push(selected);

    const removeIndex = availableNumbers.indexOf(selected);
    if (removeIndex >= 0) {
      availableNumbers.splice(removeIndex, 1);
    }
  }

  return selectedNumbers.sort((a, b) => a - b);
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

    let drawMode: "random" | "algorithm" = "random";
    let algorithmWeight: AlgorithmWeight = "most_frequent";
    let randomSelectionMode: RandomSelectionMode = "automated";
    let manualNumbers: number[] | null = null;
    try {
      const body = (await request.json()) as SimulateDrawBody;
      const requestedMode =
        typeof body.draw_mode === "string"
          ? body.draw_mode.trim().toLowerCase()
          : "";
      const requestedWeight =
        typeof body.algorithm_weight === "string"
          ? body.algorithm_weight.trim().toLowerCase()
          : "";
      const requestedRandomSelectionMode =
        typeof body.random_selection_mode === "string"
          ? body.random_selection_mode.trim().toLowerCase()
          : "";

      if (requestedMode === "algorithm" || requestedMode === "random") {
        drawMode = requestedMode;
      }

      if (
        requestedWeight === "most_frequent" ||
        requestedWeight === "least_frequent"
      ) {
        algorithmWeight = requestedWeight;
      }

      if (
        requestedRandomSelectionMode === "automated" ||
        requestedRandomSelectionMode === "manual"
      ) {
        randomSelectionMode = requestedRandomSelectionMode;
      }

      if (Array.isArray(body.manual_numbers)) {
        const parsed = body.manual_numbers
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value));

        manualNumbers = parsed;
      }
    } catch {
      // Empty body is acceptable; default mode remains random.
    }

    if (drawMode === "random" && randomSelectionMode === "manual") {
      if (!manualNumbers || manualNumbers.length !== 5) {
        return jsonError(
          "Manual random selection requires exactly 5 numbers.",
          400,
        );
      }

      if (manualNumbers.some((value) => value < 1 || value > 45)) {
        return jsonError("Manual numbers must be between 1 and 45.", 400);
      }

      const unique = new Set(manualNumbers);
      if (unique.size !== 5) {
        return jsonError("Manual numbers must be unique.", 400);
      }
    }

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

    // Only a fixed portion of active subscription revenue funds this month's base pool.
    const basePoolFromActiveSubscribers = toMoney(
      activeUserIds.length *
        MONTHLY_SUBSCRIPTION_PRICE *
        PRIZE_POOL_CONTRIBUTION_PORTION,
    );

    // Pre-defined tier shares are applied to this month's base pool.
    // Existing rollover is jackpot-only and stays in 5-match tier.
    const tierPool5 = toMoney(
      basePoolFromActiveSubscribers * POOL_SHARE_MATCH_5 + currentRollover,
    );
    const tierPool4 = toMoney(
      basePoolFromActiveSubscribers * POOL_SHARE_MATCH_4,
    );
    const tierPool3 = toMoney(
      basePoolFromActiveSubscribers * POOL_SHARE_MATCH_3,
    );

    const totalPool = toMoney(tierPool5 + tierPool4 + tierPool3);

    const winnersByTier: Record<WinnerTier, string[]> = {
      3: [],
      4: [],
      5: [],
    };

    let scoreRows: ScoreRow[] = [];

    if (activeUserIds.length > 0) {
      const { data, error: scoreError } = await serviceDb
        .from("scores")
        .select("user_id, score, date_played, created_at")
        .in("user_id", activeUserIds)
        .order("user_id", { ascending: true })
        .order("date_played", { ascending: false })
        .order("created_at", { ascending: false });

      if (scoreError) {
        return jsonError("Failed to fetch scores.", 500, scoreError.message);
      }

      scoreRows = (data ?? []) as ScoreRow[];
    }

    const winningNumbers =
      drawMode === "algorithm"
        ? generateAlgorithmBasedDrawNumbers(scoreRows, algorithmWeight)
        : randomSelectionMode === "manual"
          ? Array.from(new Set(manualNumbers ?? [])).sort((a, b) => a - b)
          : generateUniqueDrawNumbers(5, 1, 45);
    const winningSet = new Set(winningNumbers);

    if (activeUserIds.length > 0) {
      const latestFiveByUser = new Map<string, ScoreRow[]>();
      for (const row of scoreRows) {
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
        draw_mode: drawMode,
        algorithm_weight: drawMode === "algorithm" ? algorithmWeight : null,
        random_selection_mode:
          drawMode === "random" ? randomSelectionMode : null,
        manual_numbers:
          drawMode === "random" && randomSelectionMode === "manual"
            ? winningNumbers
            : null,
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

export async function DELETE(request: Request) {
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

    let body: DeleteSimulatedDrawBody = {};
    try {
      body = (await request.json()) as DeleteSimulatedDrawBody;
    } catch {
      return jsonError("Invalid JSON in request body.", 400);
    }

    const drawId =
      typeof body.draw_id === "string" && body.draw_id.trim().length > 0
        ? body.draw_id.trim()
        : null;

    if (!drawId) {
      return jsonError("Missing required field: draw_id", 400);
    }

    const serviceDb = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: drawRecord, error: drawLookupError } = await serviceDb
      .from("draws")
      .select("id, status")
      .eq("id", drawId)
      .maybeSingle();

    if (drawLookupError) {
      return jsonError("Failed to load draw.", 500, drawLookupError.message);
    }

    if (!drawRecord) {
      return jsonError("Draw not found.", 404);
    }

    if (drawRecord.status !== "simulated") {
      return jsonError("Only simulated draws can be deleted.", 400);
    }

    const { error: winnersDeleteError } = await serviceDb
      .from("winners")
      .delete()
      .eq("draw_id", drawId);

    if (winnersDeleteError) {
      return jsonError(
        "Failed to delete winners for simulated draw.",
        500,
        winnersDeleteError.message,
      );
    }

    const { error: drawDeleteError } = await serviceDb
      .from("draws")
      .delete()
      .eq("id", drawId)
      .eq("status", "simulated");

    if (drawDeleteError) {
      return jsonError(
        "Failed to delete simulated draw.",
        500,
        drawDeleteError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Simulated draw deleted successfully.",
        draw_id: drawId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError(
      "Unexpected error while deleting simulated draw.",
      500,
      message,
    );
  }
}
