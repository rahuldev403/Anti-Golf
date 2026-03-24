"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";
import DrawHistoryTable from "./components/DrawHistoryTable";
import UserManagementTable from "./components/UserManagementTable";

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
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"overview" | "users" | "draws">(
    "overview",
  );
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserScores, setSelectedUserScores] = useState<ScoreRow[]>([]);
  const [loadingScoresForUser, setLoadingScoresForUser] = useState<
    string | null
  >(null);

  const [latestDraw, setLatestDraw] = useState<DrawRow | null>(null);
  const [drawSimulationResult, setDrawSimulationResult] =
    useState<DrawSimulationResult | null>(null);
  const [isRunningDraw, setIsRunningDraw] = useState(false);
  const [isPublishingDraw, setIsPublishingDraw] = useState(false);

  const [pendingWinners, setPendingWinners] = useState<PendingWinner[]>([]);
  const [processingWinnerId, setProcessingWinnerId] = useState<string | null>(
    null,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    if (error || !session?.access_token) {
      return null;
    }

    return session.access_token;
  };

  const loadDashboardData = async (token: string) => {
    const response = await fetch("/api/admin/fetch-dashboard-data", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as {
      success?: boolean;
      error?: string;
      details?: string;
      users?: UserRow[];
      draws?: DrawRow[];
    };

    if (!response.ok || !payload.success) {
      const details = payload.details ? ` (${payload.details})` : "";
      throw new Error(
        (payload.error ?? "Failed to load dashboard data.") + details,
      );
    }

    const usersData = payload.users ?? [];
    const drawsData = payload.draws ?? [];

    setUsers(usersData);
    setDraws(drawsData);
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

        const token = await getAccessToken();
        if (!token) {
          throw new Error("Admin session expired. Please sign in again.");
        }

        await Promise.all([loadDashboardData(token), loadPendingWinners()]);
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

  const handleRunDraw = async () => {
    clearMessages();

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
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        draw?: DrawRow;
        summary?: DrawSimulationSummary;
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
      });
      setLatestDraw(payload.draw);
      setSuccessMessage("Draw simulation completed successfully.");

      await Promise.all([loadPendingWinners(), loadDashboardData(token)]);
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
      await loadDashboardData(token);
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load user scores.";
      setErrorMessage(message);
    } finally {
      setLoadingScoresForUser(null);
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
      await loadPendingWinners();
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
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold">Admin Panel</h1>

            <nav className="inline-flex flex-wrap gap-2 rounded-full border border-border/60 bg-muted/50 p-1">
              {[
                { key: "overview" as const, label: "Control Center" },
                { key: "users" as const, label: "Manage Users" },
                { key: "draws" as const, label: "Draw History" },
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

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-chart-3/40 bg-chart-3/15 p-4 text-sm text-chart-3">
            {successMessage}
          </div>
        ) : null}

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
                                className="rounded-md bg-chart-3 px-3 py-1.5 text-xs font-semibold text-foreground hover:brightness-110 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={processingWinnerId === winner.id}
                                onClick={() =>
                                  handleWinnerDecision(winner.id, "reject")
                                }
                                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-foreground hover:brightness-110 disabled:opacity-60"
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
                onViewScores={handleViewScores}
                loadingScoresForUser={loadingScoresForUser}
              />

              {selectedUserId ? (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-base font-semibold">
                    Latest 5 Scores for {selectedUserId}
                  </h3>

                  {selectedUserScores.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No scores found for this user.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {selectedUserScores.map((score: ScoreRow) => (
                        <li
                          key={score.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                        >
                          <span>Score: {score.score}</span>
                          <span className="text-muted-foreground">
                            {score.date_played}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
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
              <DrawHistoryTable draws={draws} />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
