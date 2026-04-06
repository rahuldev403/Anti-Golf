"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";
import DrawHistoryTable from "./components/DrawHistoryTable";
import UserManagementTable from "./components/UserManagementTable";
import CharityManagement from "./components/CharityManagement";

type UserRow = {
  id: string;
  role: string | null;
  created_at: string | null;
  selected_charity_id: string | null;
  selected_charity_name: string | null;
  charity_percentage: number | null;
  subscription_status: "active" | "inactive" | string;
};

type ScoreRow = {
  id: string;
  score: number;
  date_played: string;
  created_at: string;
};

type EditableScoreRow = ScoreRow & {
  draft_score: number;
  draft_date_played: string;
};

type DrawRow = {
  id: string;
  draw_date: string;
  status: "simulated" | "published" | string;
  winning_numbers: number[];
  total_prize_pool: number | null;
  rollover_amount_generated: number | null;
  jackpot_amount?: number | null;
};

type PendingWinner = {
  id: string;
  user_id: string;
  draw_id: string;
  match_type: number;
  prize_amount: number;
  payment_status: "pending" | "paid" | "verified";
  proof_image_url: string | null;
};

type DrawSimulationSummary = {
  winning_numbers: number[];
  total_pool: number;
  winners_count: {
    match_5: number;
    match_4: number;
    match_3: number;
  };
  tier_pools: {
    match_5: number;
    match_4: number;
    match_3: number;
  };
  payouts_each: {
    match_5: number;
    match_4: number;
    match_3: number;
  };
  rollover: {
    previous: number;
    generated: number;
    next: number;
  };
};

type DrawSimulationResult = {
  draw: DrawRow;
  summary: DrawSimulationSummary;
  draw_mode?: "random" | "algorithm";
  algorithm_weight?: "most_frequent" | "least_frequent" | null;
  random_selection_mode?: "automated" | "manual" | null;
  manual_numbers?: number[] | null;
};

type WinnerListRow = {
  id: string;
  user_id: string;
  draw_id: string;
  draw_date: string | null;
  match_type: number;
  prize_amount: number;
  payment_status: "pending" | "paid" | "verified" | string;
  proof_image_url: string | null;
};

type Charity = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_featured: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "draws" | "charities"
  >("overview");
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserScores, setSelectedUserScores] = useState<ScoreRow[]>([]);
  const [editableScores, setEditableScores] = useState<EditableScoreRow[]>([]);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isUpdatingScoreId, setIsUpdatingScoreId] = useState<string | null>(
    null,
  );
  const [userEditRole, setUserEditRole] = useState("user");
  const [userEditCharityId, setUserEditCharityId] = useState("");
  const [userEditContribution, setUserEditContribution] = useState(10);
  const [userEditSubscriptionStatus, setUserEditSubscriptionStatus] = useState<
    "active" | "inactive"
  >("inactive");
  const [loadingScoresForUser, setLoadingScoresForUser] = useState<
    string | null
  >(null);

  const [latestDraw, setLatestDraw] = useState<DrawRow | null>(null);
  const [drawSimulationResult, setDrawSimulationResult] =
    useState<DrawSimulationResult | null>(null);
  const [drawMode, setDrawMode] = useState<"random" | "algorithm">("random");
  const [drawAlgorithmWeight, setDrawAlgorithmWeight] = useState<
    "most_frequent" | "least_frequent"
  >("most_frequent");
  const [randomSelectionMode, setRandomSelectionMode] = useState<
    "automated" | "manual"
  >("automated");
  const [manualRandomNumbers, setManualRandomNumbers] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
  ]);
  const [isRunningDraw, setIsRunningDraw] = useState(false);
  const [isPublishingDraw, setIsPublishingDraw] = useState(false);
  const [deletingDrawId, setDeletingDrawId] = useState<string | null>(null);
  const [isRewardLogicOpen, setIsRewardLogicOpen] = useState(false);
  const [isDrawLogicOpen, setIsDrawLogicOpen] = useState(false);

  const [pendingWinners, setPendingWinners] = useState<PendingWinner[]>([]);
  const [allWinners, setAllWinners] = useState<WinnerListRow[]>([]);
  const [processingWinnerId, setProcessingWinnerId] = useState<string | null>(
    null,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const totalUsers = users.length;
    const totalPrizePool = draws.reduce(
      (sum, draw) => sum + Number(draw.total_prize_pool ?? 0),
      0,
    );
    const totalPublishedDraws = draws.filter(
      (draw) => draw.status === "published",
    ).length;
    const totalSimulatedDraws = draws.filter(
      (draw) => draw.status === "simulated",
    ).length;

    const activeContributionsByCharity = users.reduce((acc, user) => {
      if (
        user.subscription_status !== "active" ||
        !user.selected_charity_id ||
        !user.charity_percentage
      ) {
        return acc;
      }

      const monthlyContribution =
        (10 * Math.max(10, Math.min(50, Number(user.charity_percentage)))) /
        100;
      const existing = acc.get(user.selected_charity_id) ?? 0;
      acc.set(user.selected_charity_id, existing + monthlyContribution);
      return acc;
    }, new Map<string, number>());

    const charityContributionRows = Array.from(
      activeContributionsByCharity.entries(),
    )
      .map(([charityId, amount]) => ({
        charityId,
        charityName:
          charities.find((charity) => charity.id === charityId)?.name ??
          "Unknown Charity",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalUsers,
      totalPrizePool,
      totalPublishedDraws,
      totalSimulatedDraws,
      totalWinners: allWinners.length,
      paidWinners: allWinners.filter(
        (winner) => winner.payment_status === "paid",
      ).length,
      pendingWinners: allWinners.filter(
        (winner) => winner.payment_status === "pending",
      ).length,
      charityContributionRows,
    };
  }, [allWinners, charities, draws, users]);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!supabase) {
      return null;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (!error && session?.access_token) {
      return session.access_token;
    }

    const refreshResult = await supabase.auth.refreshSession();
    return refreshResult.data.session?.access_token ?? null;
  };

  const loadDashboardData = async () => {
    const response = await fetch("/api/admin/fetch-dashboard-data", {
      method: "GET",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      error?: string;
      details?: string;
      users?: UserRow[];
      draws?: DrawRow[];
      charities?: Charity[];
    };

    if (!response.ok || !payload.success) {
      const details = payload.details ? ` (${payload.details})` : "";
      throw new Error(
        (payload.error ?? "Failed to load dashboard data.") + details,
      );
    }

    const usersData = payload.users ?? [];
    const drawsData = payload.draws ?? [];
    const charitiesData = payload.charities ?? [];

    setUsers(usersData);
    setDraws(drawsData);
    setCharities(charitiesData);
    setLatestDraw(drawsData[0] ?? null);
  };

  const loadPendingWinners = async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("winners")
      .select(
        "id, user_id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
      )
      .eq("payment_status", "pending")
      .order("id", { ascending: false });

    if (error) {
      throw new Error(`Failed to load pending winners: ${error.message}`);
    }

    setPendingWinners((data ?? []) as PendingWinner[]);
  };

  const loadAllWinners = async () => {
    const response = await fetch("/api/admin/winners", {
      method: "GET",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      error?: string;
      winners?: WinnerListRow[];
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? "Failed to fetch winners list.");
    }

    setAllWinners(payload.winners ?? []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      clearMessages();

      if (!supabase) {
        setErrorMessage(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
        );
        setIsCheckingAccess(false);
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setIsAdmin(false);
          setErrorMessage(
            "You must be signed in as admin to access this page.",
          );
          router.replace("/");
          setIsCheckingAccess(false);
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw new Error(`Failed to verify role: ${profileError.message}`);
        }

        if (userProfile?.role !== "admin") {
          setIsAdmin(false);
          setErrorMessage("Access denied. Admin role required.");
          router.replace("/");
          setIsCheckingAccess(false);
          return;
        }

        setIsAdmin(true);

        await Promise.all([
          loadDashboardData(),
          loadPendingWinners(),
          loadAllWinners(),
        ]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load admin dashboard.";
        setErrorMessage(message);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    void bootstrap();
  }, [router, supabase]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = window.setTimeout(() => setErrorMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleRunDraw = async () => {
    clearMessages();

    if (drawMode === "random" && randomSelectionMode === "manual") {
      const parsedManualNumbers = manualRandomNumbers.map((value) =>
        Number(value.trim()),
      );

      if (
        parsedManualNumbers.some(
          (value) => !Number.isInteger(value) || value < 1 || value > 45,
        )
      ) {
        setErrorMessage(
          "Manual numbers must be whole numbers between 1 and 45.",
        );
        return;
      }

      if (new Set(parsedManualNumbers).size !== 5) {
        setErrorMessage("Manual numbers must be 5 unique values.");
        return;
      }
    }

    const token = await getAccessToken();
    if (!token) {
      setErrorMessage("Admin session expired. Please sign in again.");
      return;
    }

    try {
      setIsRunningDraw(true);

      const response = await fetch("/api/admin/draw/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          draw_mode: drawMode,
          algorithm_weight: drawAlgorithmWeight,
          random_selection_mode: randomSelectionMode,
          manual_numbers:
            drawMode === "random" && randomSelectionMode === "manual"
              ? manualRandomNumbers.map((value) => Number(value.trim()))
              : null,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        draw?: DrawRow;
        summary?: DrawSimulationSummary;
        draw_mode?: "random" | "algorithm";
        algorithm_weight?: "most_frequent" | "least_frequent" | null;
        random_selection_mode?: "automated" | "manual" | null;
        manual_numbers?: number[] | null;
      };

      if (
        !response.ok ||
        !payload.success ||
        !payload.draw ||
        !payload.summary
      ) {
        const details = payload.details ? ` (${payload.details})` : "";
        throw new Error(
          (payload.error ?? "Failed to run draw simulation.") + details,
        );
      }

      setDrawSimulationResult({
        draw: payload.draw,
        summary: payload.summary,
        draw_mode: payload.draw_mode,
        algorithm_weight: payload.algorithm_weight,
        random_selection_mode: payload.random_selection_mode,
        manual_numbers: payload.manual_numbers,
      });
      setLatestDraw(payload.draw);
      setSuccessMessage("Draw simulation completed successfully.");

      await Promise.all([
        loadPendingWinners(),
        loadDashboardData(),
        loadAllWinners(),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run draw.";
      setErrorMessage(message);
    } finally {
      setIsRunningDraw(false);
    }
  };

  const handlePublishDraw = async () => {
    clearMessages();

    if (
      !window.confirm(
        "Publish this simulation as official monthly results? This action updates jackpot rollover for next month.",
      )
    ) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setErrorMessage("Admin session expired. Please sign in again.");
      return;
    }

    try {
      setIsPublishingDraw(true);

      const response = await fetch("/api/admin/draw/publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        draw?: DrawRow;
        message?: string;
        rollover_applied_for_next_month?: number;
      };

      if (!response.ok || !payload.success || !payload.draw) {
        const details = payload.details ? ` (${payload.details})` : "";
        throw new Error((payload.error ?? "Failed to publish draw.") + details);
      }

      setLatestDraw(payload.draw);
      setDrawSimulationResult((previous: DrawSimulationResult | null) =>
        previous ? { ...previous, draw: payload.draw as DrawRow } : previous,
      );
      setSuccessMessage(payload.message ?? "Draw published successfully.");
      await loadDashboardData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to publish draw.";
      setErrorMessage(message);
    } finally {
      setIsPublishingDraw(false);
    }
  };

  const handleViewScores = async (userId: string) => {
    clearMessages();

    if (!supabase) {
      setErrorMessage("Supabase client is unavailable.");
      return;
    }

    try {
      setLoadingScoresForUser(userId);
      setSelectedUserId(userId);

      const { data, error } = await supabase
        .from("scores")
        .select("id, score, date_played, created_at")
        .eq("user_id", userId)
        .order("date_played", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(error.message);
      }

      setSelectedUserScores((data ?? []) as ScoreRow[]);
      setEditableScores(
        ((data ?? []) as ScoreRow[]).map((score) => ({
          ...score,
          draft_score: score.score,
          draft_date_played: score.date_played,
        })),
      );

      const selectedUser = users.find((item) => item.id === userId);
      setUserEditRole(selectedUser?.role ?? "user");
      setUserEditCharityId(selectedUser?.selected_charity_id ?? "");
      setUserEditContribution(
        Math.min(
          50,
          Math.max(
            10,
            Math.round(Number(selectedUser?.charity_percentage ?? 10)),
          ),
        ),
      );
      setUserEditSubscriptionStatus(
        selectedUser?.subscription_status === "active" ? "active" : "inactive",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load user scores.";
      setErrorMessage(message);
    } finally {
      setLoadingScoresForUser(null);
    }
  };

  const closeScoresPanel = () => {
    setSelectedUserId(null);
    setSelectedUserScores([]);
    setEditableScores([]);
  };

  const handleManageUser = async (userId: string) => {
    await handleViewScores(userId);
  };

  const handleSaveUserSettings = async () => {
    clearMessages();

    if (!selectedUserId) {
      setErrorMessage("Select a user first.");
      return;
    }

    try {
      setIsUpdatingUser(true);

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: userEditRole,
          selected_charity_id: userEditCharityId,
          charity_percentage: userEditContribution,
          subscription_status: userEditSubscriptionStatus,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        user?: {
          id: string;
          role: string | null;
          selected_charity_id: string | null;
          charity_percentage: number | null;
          subscription_status: string;
        };
      };

      if (!response.ok || !payload.success || !payload.user) {
        throw new Error(payload.error ?? "Failed to update user settings.");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === payload.user?.id
            ? {
                ...user,
                role: payload.user.role,
                selected_charity_id: payload.user.selected_charity_id,
                charity_percentage: payload.user.charity_percentage,
                subscription_status: payload.user.subscription_status,
                selected_charity_name:
                  charities.find(
                    (charity) =>
                      charity.id === payload.user?.selected_charity_id,
                  )?.name ?? null,
              }
            : user,
        ),
      );

      setSuccessMessage(payload.message ?? "User settings updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update user.";
      setErrorMessage(message);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleEditableScoreChange = (
    scoreId: string,
    field: "draft_score" | "draft_date_played",
    value: string,
  ) => {
    setEditableScores((prev) =>
      prev.map((row) =>
        row.id === scoreId
          ? {
              ...row,
              [field]: field === "draft_score" ? Number(value) : value,
            }
          : row,
      ),
    );
  };

  const handleSaveScore = async (scoreId: string) => {
    clearMessages();
    const target = editableScores.find((row) => row.id === scoreId);

    if (!target) {
      return;
    }

    try {
      setIsUpdatingScoreId(scoreId);

      const response = await fetch("/api/admin/users/scores", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score_id: scoreId,
          score: target.draft_score,
          date_played: target.draft_date_played,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        score?: ScoreRow;
      };

      if (!response.ok || !payload.success || !payload.score) {
        throw new Error(payload.error ?? "Failed to update score.");
      }

      setEditableScores((prev) =>
        prev.map((row) =>
          row.id === scoreId
            ? {
                ...payload.score,
                draft_score: payload.score.score,
                draft_date_played: payload.score.date_played,
              }
            : row,
        ),
      );
      setSelectedUserScores((prev) =>
        prev.map((row) => (row.id === scoreId ? payload.score! : row)),
      );

      setSuccessMessage(payload.message ?? "Score updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update score.";
      setErrorMessage(message);
    } finally {
      setIsUpdatingScoreId(null);
    }
  };

  const handleWinnerDecision = async (
    winnerId: string,
    action: "approve" | "reject",
  ) => {
    clearMessages();

    const token = await getAccessToken();
    if (!token) {
      setErrorMessage("Admin session expired. Please sign in again.");
      return;
    }

    try {
      setProcessingWinnerId(winnerId);

      const response = await fetch("/api/admin/winner-decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          winner_id: winnerId,
          action,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        const details = payload.details ? ` (${payload.details})` : "";
        throw new Error(
          (payload.error ?? "Failed to process winner decision.") + details,
        );
      }

      setSuccessMessage(payload.message ?? "Winner decision processed.");
      await Promise.all([loadPendingWinners(), loadAllWinners()]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process winner decision.";
      setErrorMessage(message);
    } finally {
      setProcessingWinnerId(null);
    }
  };

  const handleDeleteSimulatedDraw = async (drawId: string) => {
    clearMessages();

    if (!window.confirm("Delete this simulated draw and its winners?")) {
      return;
    }

    try {
      setDeletingDrawId(drawId);

      const response = await fetch("/api/admin/draw/simulate", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draw_id: drawId }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        const details = payload.details ? ` (${payload.details})` : "";
        throw new Error(
          (payload.error ?? "Failed to delete simulated draw.") + details,
        );
      }

      setDraws((prev) => prev.filter((draw) => draw.id !== drawId));
      setLatestDraw((prev) => (prev?.id === drawId ? null : prev));
      setDrawSimulationResult((prev) =>
        prev?.draw.id === drawId ? null : prev,
      );
      setSuccessMessage(payload.message ?? "Simulated draw deleted.");

      await Promise.all([
        loadDashboardData(),
        loadPendingWinners(),
        loadAllWinners(),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete simulated draw.";
      setErrorMessage(message);
    } finally {
      setDeletingDrawId(null);
    }
  };

  const handleMarkPayoutCompleted = async (winnerId: string) => {
    clearMessages();

    try {
      setProcessingWinnerId(winnerId);

      const response = await fetch("/api/admin/winners", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winner_id: winnerId,
          action: "mark_paid",
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to mark payout complete.");
      }

      setSuccessMessage(payload.message ?? "Payout updated.");
      await Promise.all([loadPendingWinners(), loadAllWinners()]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to mark payout complete.";
      setErrorMessage(message);
    } finally {
      setProcessingWinnerId(null);
    }
  };

  if (isCheckingAccess) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-6">
          Checking admin access...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto max-w-6xl rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          Access denied. This page is only available to admins.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="pointer-events-none fixed right-4 top-4 z-90 flex w-[min(92vw,26rem)] flex-col gap-2">
        <AnimatePresence>
          {errorMessage ? (
            <motion.div
              key={`error-${errorMessage}`}
              initial={{ opacity: 0, x: 16, y: -8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 16, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto rounded-xl border border-destructive/40 bg-destructive/95 p-3 text-sm text-destructive-foreground shadow-lg"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="mt-0.5 rounded p-1 text-destructive-foreground/80 transition hover:bg-black/10 hover:text-destructive-foreground"
                  aria-label="Close error notification"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : null}

          {successMessage ? (
            <motion.div
              key={`success-${successMessage}`}
              initial={{ opacity: 0, x: 16, y: -8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 16, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto rounded-xl border border-emerald-300/70 bg-emerald-600 p-3 text-sm text-white shadow-lg"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{successMessage}</p>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="mt-0.5 rounded p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close success notification"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold">Admin Panel</h1>

            <nav className="inline-flex flex-wrap gap-2 rounded-full border border-border/60 bg-muted/50 p-1">
              {[
                { key: "overview" as const, label: "Control Center" },
                { key: "users" as const, label: "Manage Users" },
                { key: "draws" as const, label: "Draw History" },
                { key: "charities" as const, label: "Manage Charities" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-xl font-semibold">Run Simulation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run and publish monthly draw simulations.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRewardLogicOpen(true)}
                    className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
                  >
                    View Reward Logic
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawLogicOpen(true)}
                    className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
                  >
                    View Draw Logic
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Draw Logic Mode
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawMode("random")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        drawMode === "random"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Random
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawMode("algorithm")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        drawMode === "algorithm"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Algorithm-Based
                    </button>
                  </div>

                  {drawMode === "algorithm" ? (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Algorithm Weight
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDrawAlgorithmWeight("most_frequent")
                          }
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            drawAlgorithmWeight === "most_frequent"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Most Frequent Scores
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDrawAlgorithmWeight("least_frequent")
                          }
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            drawAlgorithmWeight === "least_frequent"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Least Frequent Scores
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {drawMode === "random" ? (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Random Selection Mode
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setRandomSelectionMode("automated")}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            randomSelectionMode === "automated"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Automated (Existing)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRandomSelectionMode("manual")}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            randomSelectionMode === "manual"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Manual (Testing)
                        </button>
                      </div>

                      {randomSelectionMode === "manual" ? (
                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {manualRandomNumbers.map((value, index) => (
                            <input
                              key={`manual-draw-${index}`}
                              type="number"
                              min={1}
                              max={45}
                              value={value}
                              onChange={(event) => {
                                const next = [...manualRandomNumbers];
                                next[index] = event.target.value;
                                setManualRandomNumbers(next);
                              }}
                              aria-label={`Manual draw number ${index + 1}`}
                              title={`Manual draw number ${index + 1}`}
                              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRunDraw}
                    disabled={isRunningDraw}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    {isRunningDraw ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                        Running Monthly Draw Simulation...
                      </>
                    ) : (
                      "Run Monthly Draw Simulation"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePublishDraw}
                    disabled={
                      isPublishingDraw ||
                      !latestDraw ||
                      latestDraw.status === "published"
                    }
                    className="rounded-lg bg-chart-3 px-4 py-2 text-sm font-bold text-black dark:text-black hover:brightness-110 disabled:opacity-60"
                  >
                    {isPublishingDraw
                      ? "Publishing Official Results..."
                      : "Publish Official Results"}
                  </button>
                </div>

                {latestDraw ? (
                  <div className="mt-5 rounded-xl border border-border bg-background/70 p-4 text-sm">
                    <p className="text-muted-foreground">
                      Latest Draw ID: {latestDraw.id}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Status: {latestDraw.status}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Draw Mode:{" "}
                      {drawSimulationResult?.draw.id === latestDraw.id
                        ? drawSimulationResult.draw_mode
                        : "N/A (for previously loaded draw)"}
                    </p>
                    {drawSimulationResult?.draw.id === latestDraw.id &&
                    drawSimulationResult.draw_mode === "algorithm" ? (
                      <p className="mt-1 text-muted-foreground">
                        Algorithm Weight:{" "}
                        {(drawSimulationResult.algorithm_weight ?? "")
                          .replace("_", " ")
                          .replace("_", " ")}
                      </p>
                    ) : null}
                    {drawSimulationResult?.draw.id === latestDraw.id &&
                    drawSimulationResult.draw_mode === "random" &&
                    drawSimulationResult.random_selection_mode === "manual" ? (
                      <p className="mt-1 text-muted-foreground">
                        Random Selection: Manual (
                        {(drawSimulationResult.manual_numbers ?? []).join(", ")}
                        )
                      </p>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">
                      Winning Numbers:{" "}
                      {Array.isArray(latestDraw.winning_numbers)
                        ? latestDraw.winning_numbers.join(", ")
                        : "N/A"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Total Prize Pool: ${latestDraw.total_prize_pool ?? 0}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Rollover Generated: $
                      {latestDraw.rollover_amount_generated ?? 0}
                    </p>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">
                    No draw has been created yet.
                  </p>
                )}

                {drawSimulationResult ? (
                  <div className="mt-5 rounded-xl border border-primary/30 bg-linear-to-br from-primary/15 via-card to-accent/20 p-5 text-sm">
                    <h3 className="text-base font-semibold text-foreground">
                      Simulation Results Snapshot
                    </h3>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Winning Numbers
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {drawSimulationResult.summary.winning_numbers.map(
                          (number) => (
                            <span
                              key={number}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/50 bg-primary/20 font-bold text-primary"
                            >
                              {number}
                            </span>
                          ),
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-lg font-semibold text-foreground">
                      Total Prize Pool Generated: $
                      {drawSimulationResult.summary.total_pool}
                    </p>

                    <div className="mt-4 overflow-x-auto rounded-lg border border-border/60 bg-background/70">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Tier</th>
                            <th className="px-3 py-2 font-medium">Winners</th>
                            <th className="px-3 py-2 font-medium">
                              Payout / User
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border/60">
                            <td className="px-3 py-2">5-Match</td>
                            <td className="px-3 py-2">
                              {
                                drawSimulationResult.summary.winners_count
                                  .match_5
                              }
                            </td>
                            <td className="px-3 py-2">
                              $
                              {
                                drawSimulationResult.summary.payouts_each
                                  .match_5
                              }
                            </td>
                          </tr>
                          <tr className="border-b border-border/60">
                            <td className="px-3 py-2">4-Match</td>
                            <td className="px-3 py-2">
                              {
                                drawSimulationResult.summary.winners_count
                                  .match_4
                              }
                            </td>
                            <td className="px-3 py-2">
                              $
                              {
                                drawSimulationResult.summary.payouts_each
                                  .match_4
                              }
                            </td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2">3-Match</td>
                            <td className="px-3 py-2">
                              {
                                drawSimulationResult.summary.winners_count
                                  .match_3
                              }
                            </td>
                            <td className="px-3 py-2">
                              $
                              {
                                drawSimulationResult.summary.payouts_each
                                  .match_3
                              }
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-4 font-medium text-foreground">
                      Rollover Amount for Next Month: $
                      {drawSimulationResult.summary.rollover.generated}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Users
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {analytics.totalUsers}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Prize Pool
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      ${analytics.totalPrizePool.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Draw Statistics
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Published: {analytics.totalPublishedDraws} | Simulated:{" "}
                      {analytics.totalSimulatedDraws}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Winners: {analytics.totalWinners} | Paid:{" "}
                      {analytics.paidWinners}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Pending Payouts
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {analytics.pendingWinners}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-4">
                  <h3 className="text-sm font-semibold">
                    Charity Contribution Totals (Monthly Projection)
                  </h3>
                  {analytics.charityContributionRows.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {analytics.charityContributionRows.map((row) => (
                        <li
                          key={row.charityId}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{row.charityName}</span>
                          <span className="font-semibold text-foreground">
                            ${row.amount.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No active contribution data yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-xl font-semibold">Pending Verifications</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review pending winners and validate uploaded proof images.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Winner ID</th>
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 font-medium">Match</th>
                        <th className="px-3 py-2 font-medium">Prize</th>
                        <th className="px-3 py-2 font-medium">Proof</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingWinners.map((winner: PendingWinner) => (
                        <tr
                          key={winner.id}
                          className="border-b border-border/70 align-top"
                        >
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {winner.id}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {winner.user_id}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {winner.match_type}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            ${winner.prize_amount}
                          </td>
                          <td className="px-3 py-3">
                            {winner.proof_image_url ? (
                              <a
                                href={winner.proof_image_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-primary hover:text-primary/80"
                              >
                                View Image
                              </a>
                            ) : (
                              <span className="text-muted-foreground">
                                Not uploaded
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={processingWinnerId === winner.id}
                                onClick={() =>
                                  handleWinnerDecision(winner.id, "approve")
                                }
                                className="rounded-md bg-chart-3 px-3 py-1.5 text-xs font-bold text-black dark:text-black hover:brightness-110 disabled:opacity-60"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={processingWinnerId === winner.id}
                                onClick={() =>
                                  handleWinnerDecision(winner.id, "reject")
                                }
                                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-black dark:text-black hover:brightness-110 disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pendingWinners.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No pending winners to verify.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-xl font-semibold">Winners Management</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  View full winners list and mark payouts as completed.
                </p>

                {allWinners.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No winners yet.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Winner</th>
                          <th className="px-3 py-2 font-medium">User</th>
                          <th className="px-3 py-2 font-medium">Draw Date</th>
                          <th className="px-3 py-2 font-medium">Match</th>
                          <th className="px-3 py-2 font-medium">Prize</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allWinners.slice(0, 50).map((winner) => (
                          <tr
                            key={winner.id}
                            className="border-b border-border/70 align-top"
                          >
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {winner.id}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {winner.user_id}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {winner.draw_date
                                ? new Date(
                                    winner.draw_date,
                                  ).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {winner.match_type}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              ${winner.prize_amount}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground capitalize">
                              {winner.payment_status}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  handleMarkPayoutCompleted(winner.id)
                                }
                                disabled={
                                  processingWinnerId === winner.id ||
                                  winner.payment_status === "paid"
                                }
                                className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
                              >
                                {processingWinnerId === winner.id
                                  ? "Updating..."
                                  : winner.payment_status === "paid"
                                    ? "Paid"
                                    : "Mark Paid"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isRewardLogicOpen ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-80 bg-black/50 p-4"
                    onClick={() => setIsRewardLogicOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            Reward Logic (Enforced)
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Pricing and payout rules applied during simulation.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRewardLogicOpen(false)}
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label="Close reward logic"
                          title="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li>
                          5-Number Match: 40% pool share + jackpot rollover.
                        </li>
                        <li>4-Number Match: 35% pool share.</li>
                        <li>3-Number Match: 25% pool share.</li>
                        <li>
                          Pool tiers are auto-calculated from active subscriber
                          count.
                        </li>
                        <li>Winners in the same tier split prizes equally.</li>
                        <li>
                          If 5-match has no winner, jackpot carries forward to
                          next month.
                        </li>
                      </ul>
                    </motion.div>
                  </motion.div>
                ) : null}

                {isDrawLogicOpen ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-80 bg-black/50 p-4"
                    onClick={() => setIsDrawLogicOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            Draw Logic Options
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            How winning numbers are generated for each
                            simulation.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDrawLogicOpen(false)}
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label="Close draw logic"
                          title="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li>
                          Random generation: picks 5 unique numbers from 1-45
                          using standard lottery randomness.
                        </li>
                        <li>
                          Random manual mode: admin can input 5 unique numbers
                          (1-45) for controlled test runs.
                        </li>
                        <li>
                          Algorithmic generation: picks 5 unique numbers from
                          1-45 using weighted sampling from historical user
                          scores.
                        </li>
                        <li>
                          Most Frequent Scores: numbers appearing more often in
                          user score history get higher selection probability.
                        </li>
                        <li>
                          Least Frequent Scores: numbers appearing less often
                          get higher selection probability.
                        </li>
                        <li>
                          In algorithm mode, each selected number is removed
                          before the next pick, so no duplicate winning numbers
                          are possible.
                        </li>
                      </ul>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.section>
          ) : null}

          {activeTab === "users" ? (
            <motion.section
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              <UserManagementTable
                users={users}
                onManageUser={handleManageUser}
              />

              {selectedUserId ? (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold">
                      Latest 5 Scores for {selectedUserId}
                    </h3>
                    <button
                      type="button"
                      onClick={closeScoresPanel}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Close
                    </button>
                  </div>

                  {selectedUserScores.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No scores found for this user.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {editableScores.map((score) => (
                        <div
                          key={score.id}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-3 text-sm md:grid-cols-[140px_1fr_110px]"
                        >
                          <input
                            type="number"
                            min={1}
                            max={45}
                            aria-label="Golf score"
                            title="Golf score"
                            value={score.draft_score}
                            onChange={(event) =>
                              handleEditableScoreChange(
                                score.id,
                                "draft_score",
                                event.target.value,
                              )
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                          />
                          <input
                            type="date"
                            aria-label="Date played"
                            title="Date played"
                            value={score.draft_date_played}
                            onChange={(event) =>
                              handleEditableScoreChange(
                                score.id,
                                "draft_date_played",
                                event.target.value,
                              )
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveScore(score.id)}
                            disabled={isUpdatingScoreId === score.id}
                            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
                          >
                            {isUpdatingScoreId === score.id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-background/60 p-3 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Role
                      </span>
                      <select
                        value={userEditRole}
                        onChange={(event) =>
                          setUserEditRole(event.target.value)
                        }
                        className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Subscription
                      </span>
                      <select
                        value={userEditSubscriptionStatus}
                        onChange={(event) =>
                          setUserEditSubscriptionStatus(
                            event.target.value as "active" | "inactive",
                          )
                        }
                        className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Charity Beneficiary
                      </span>
                      <select
                        value={userEditCharityId}
                        onChange={(event) =>
                          setUserEditCharityId(event.target.value)
                        }
                        className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Not selected</option>
                        {charities.map((charity) => (
                          <option key={charity.id} value={charity.id}>
                            {charity.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Charity Contribution %
                      </span>
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={userEditContribution}
                        onChange={(event) =>
                          setUserEditContribution(Number(event.target.value))
                        }
                        className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleSaveUserSettings}
                        disabled={isUpdatingUser}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
                      >
                        {isUpdatingUser
                          ? "Saving user..."
                          : "Save User Settings"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.section>
          ) : null}

          {activeTab === "draws" ? (
            <motion.section
              key="draws"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DrawHistoryTable
                draws={draws}
                onDeleteSimulatedDraw={handleDeleteSimulatedDraw}
                deletingDrawId={deletingDrawId}
              />
            </motion.section>
          ) : null}

          {activeTab === "charities" ? (
            <motion.section
              key="charities"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <CharityManagement initialCharities={charities} />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
