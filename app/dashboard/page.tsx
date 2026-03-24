"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";
import WinnerVerificationAlert from "./components/WinnerVerificationAlert";
import ActiveDrawStatus from "./components/ActiveDrawStatus";

type ScoreRow = {
  id: string;
  score: number;
  date_played: string;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  status: "active" | "inactive";
  plan_type: "monthly" | "yearly";
};

type UserProfileRow = {
  selected_charity_id: string | null;
  charity_percentage: number;
};

type CharityRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

type PendingWinnerRow = {
  id: string;
  draw_id: string;
  match_type: number;
  prize_amount: number;
  payment_status: "pending" | "paid";
  proof_image_url: string | null;
};

type ScoreApiResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  scores?: ScoreRow[];
};

type WinnerAmountRow = {
  prize_amount: number;
};

type SystemSettingsRow = {
  current_jackpot_rollover: number;
};

const todayIso = new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [isSavingContribution, setIsSavingContribution] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(
    null,
  );
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [selectedCharity, setSelectedCharity] = useState<CharityRow | null>(
    null,
  );
  const [contributionPercent, setContributionPercent] = useState<number>(10);
  const [pendingWinner, setPendingWinner] = useState<PendingWinnerRow | null>(
    null,
  );
  const [totalWinnings, setTotalWinnings] = useState<number>(0);
  const [latestDraw, setLatestDraw] = useState<any>(null);
  const [currentJackpot, setCurrentJackpot] = useState<number>(0);

  const [scoreInput, setScoreInput] = useState<string>("");
  const [dateInput, setDateInput] = useState<string>(todayIso);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checkoutToastMessage, setCheckoutToastMessage] = useState<
    string | null
  >(null);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") {
      return;
    }

    setCheckoutToastMessage("Subscription activated successfully.");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!checkoutToastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCheckoutToastMessage(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [checkoutToastMessage]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!supabase) {
        setErrorMessage(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrorMessage("You must be signed in to view your dashboard.");
          setIsLoading(false);
          return;
        }

        setUserId(user.id);

        const [
          subscriptionsRes,
          scoresRes,
          profileRes,
          winnerRes,
          winningsRes,
          latestPublishedDrawRes,
          jackpotRes,
        ] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("status, plan_type")
            .eq("user_id", user.id),
          supabase
            .from("scores")
            .select("id, score, date_played, created_at")
            .eq("user_id", user.id)
            .order("date_played", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("users")
            .select("selected_charity_id, charity_percentage")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("winners")
            .select(
              "id, draw_id, match_type, prize_amount, payment_status, proof_image_url",
            )
            .eq("user_id", user.id)
            .eq("payment_status", "pending")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("winners")
            .select("prize_amount")
            .eq("user_id", user.id),
          supabase
            .from("draws")
            .select("*")
            .eq("status", "published")
            .order("draw_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("system_settings")
            .select("current_jackpot_rollover")
            .eq("id", 1)
            .maybeSingle(),
        ]);

        if (subscriptionsRes.error) {
          throw new Error(
            `Failed to load subscription: ${subscriptionsRes.error.message}`,
          );
        }
        if (scoresRes.error) {
          throw new Error(`Failed to load scores: ${scoresRes.error.message}`);
        }
        if (profileRes.error) {
          throw new Error(
            `Failed to load profile: ${profileRes.error.message}`,
          );
        }
        if (winnerRes.error) {
          throw new Error(
            `Failed to load winner status: ${winnerRes.error.message}`,
          );
        }
        if (winningsRes.error) {
          throw new Error(
            `Failed to load winnings: ${winningsRes.error.message}`,
          );
        }
        if (latestPublishedDrawRes.error) {
          throw new Error(
            `Failed to load latest draw: ${latestPublishedDrawRes.error.message}`,
          );
        }
        if (jackpotRes.error) {
          throw new Error(
            `Failed to load jackpot: ${jackpotRes.error.message}`,
          );
        }

        const subscriptionRows =
          (subscriptionsRes.data as SubscriptionRow[] | null) ?? [];
        const activeSubscription = subscriptionRows.find(
          (row) => row.status === "active",
        );
        setSubscription(activeSubscription ?? subscriptionRows[0] ?? null);
        setScores((scoresRes.data as ScoreRow[]) ?? []);

        const profile = (profileRes.data as UserProfileRow | null) ?? null;
        const safeContribution = Math.min(
          50,
          Math.max(10, Number(profile?.charity_percentage ?? 10)),
        );
        setContributionPercent(safeContribution);

        if (profile?.selected_charity_id) {
          const { data: charityData, error: charityError } = await supabase
            .from("charities")
            .select("id, name, description, image_url")
            .eq("id", profile.selected_charity_id)
            .maybeSingle();

          if (charityError) {
            throw new Error(`Failed to load charity: ${charityError.message}`);
          }

          setSelectedCharity((charityData as CharityRow | null) ?? null);
        } else {
          setSelectedCharity(null);
        }

        setPendingWinner((winnerRes.data as PendingWinnerRow | null) ?? null);

        const total = ((winningsRes.data ?? []) as WinnerAmountRow[]).reduce(
          (sum, item) => sum + Number(item.prize_amount ?? 0),
          0,
        );
        setTotalWinnings(total);

        setLatestDraw(latestPublishedDrawRes.data ?? null);
        setCurrentJackpot(
          Number(
            (jackpotRes.data as SystemSettingsRow | null)
              ?.current_jackpot_rollover ?? 0,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load dashboard.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboard();
  }, [supabase]);

  const handleScoreSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase client is unavailable.");
      return;
    }

    const parsedScore = Number(scoreInput);
    if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 45) {
      setErrorMessage("Score must be an integer between 1 and 45.");
      return;
    }

    if (!dateInput) {
      setErrorMessage("Please select a valid date.");
      return;
    }

    try {
      setIsSubmittingScore(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage("You must be signed in to submit a score.");
        return;
      }

      const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          score: parsedScore,
          date_played: dateInput,
        }),
      });

      let payload: ScoreApiResponse | null = null;
      try {
        payload = (await response.json()) as ScoreApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        const apiError = payload?.error ?? "Failed to submit score.";
        const apiDetails = payload?.details ? ` (${payload.details})` : "";
        setErrorMessage(`${apiError}${apiDetails}`);
        return;
      }

      setScores(Array.isArray(payload.scores) ? payload.scores : []);
      setScoreInput("");
      setSuccessMessage("Score submitted successfully.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error while submitting score.";
      setErrorMessage(message);
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleContributionSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase || !userId) {
      setErrorMessage("You must be signed in to update contribution settings.");
      return;
    }

    const safePercent = Math.min(50, Math.max(10, contributionPercent));

    try {
      setIsSavingContribution(true);

      const { error } = await supabase
        .from("users")
        .update({ charity_percentage: safePercent })
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
      }

      setContributionPercent(safePercent);
      setSuccessMessage("Contribution percentage updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update contribution percentage.";
      setErrorMessage(message);
    } finally {
      setIsSavingContribution(false);
    }
  };

  const handleProofUpload = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase || !userId) {
      setErrorMessage("You must be signed in to upload verification.");
      return;
    }

    if (!pendingWinner) {
      setErrorMessage("No pending winner record was found.");
      return;
    }

    if (!proofFile) {
      setErrorMessage("Please choose an image file to upload.");
      return;
    }

    const isImage = proofFile.type.startsWith("image/");
    const maxSizeBytes = 10 * 1024 * 1024;

    if (!isImage) {
      setErrorMessage("Proof file must be an image.");
      return;
    }

    if (proofFile.size > maxSizeBytes) {
      setErrorMessage("Image size must be 10MB or smaller.");
      return;
    }

    const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${userId}/${pendingWinner.id}-${Date.now()}-${safeName}`;

    try {
      setIsUploadingProof(true);

      const { error: uploadError } = await supabase.storage
        .from("winner-proofs")
        .upload(filePath, proofFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("winner-proofs")
        .getPublicUrl(filePath);

      const proofUrl = publicUrlData.publicUrl || filePath;

      const { error: updateError } = await supabase
        .from("winners")
        .update({ proof_image_url: proofUrl })
        .eq("id", pendingWinner.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setPendingWinner({ ...pendingWinner, proof_image_url: proofUrl });
      setProofFile(null);
      setSuccessMessage("Verification proof uploaded successfully.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload verification proof.";
      setErrorMessage(message);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const subscriptionLabel =
    subscription?.status === "active" ? "Active" : "Inactive";
  const isSubscriptionActive = subscription?.status === "active";
  const hasPendingWinner = pendingWinner?.payment_status === "pending";
  const isLatestDrawWinner = Boolean(
    latestDraw && pendingWinner && pendingWinner.draw_id === latestDraw.id,
  );

  return (
    <div className="space-y-6 text-foreground">
      {checkoutToastMessage ? (
        <div className="fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border border-chart-3/50 bg-card px-4 py-3 text-sm text-foreground shadow-xl">
          <p className="font-semibold text-chart-3">Billing Success</p>
          <p className="mt-1 text-muted-foreground">{checkoutToastMessage}</p>
        </div>
      ) : null}

      <WinnerVerificationAlert
        isVisible={Boolean(hasPendingWinner)}
        pendingPrizeAmount={pendingWinner?.prize_amount}
        isUploading={isUploadingProof}
        onFileChange={setProofFile}
        onSubmit={handleProofUpload}
      />

      {/* Illustration Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-primary/30 bg-linear-to-br from-primary/5 via-primary/2 to-transparent p-8 shadow-sm"
      >
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/illustration.png"
            alt="Golf Impact illustration"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <Image
              src="/logo.png"
              alt="Golf Impact illustration"
              width={100}
              height={100}
              className="object-contain rounded-2xl"
            />
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Your Golf Impact Hub
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left sm:text-base">
                Every swing counts. Every score matters.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <ActiveDrawStatus
        isSubscribed={subscription?.status === "active"}
        scoreCount={scores.length}
        currentJackpot={currentJackpot}
      />

      <section className="rounded-xl border border-primary/30 bg-primary/10 p-6 shadow-sm">
        {latestDraw ? (
          <>
            <h2 className="text-xl font-semibold">Latest Draw Results</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Draw Date: {new Date(latestDraw.draw_date).toLocaleDateString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total Prize Pool: $
              {Number(latestDraw.total_prize_pool ?? 0).toFixed(2)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(latestDraw.winning_numbers ?? []).map(
                (number: number, index: number) => (
                  <span
                    key={`${number}-${index}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                  >
                    {number}
                  </span>
                ),
              )}
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl font-semibold">Latest Draw Results</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Waiting for the next official draw to be published. Submit your
              scores now!
            </p>
          </div>
        )}
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

      {isLoading ? (
        <div className="rounded-xl border border-border/50 bg-card p-6 text-muted-foreground shadow-sm">
          Loading dashboard...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3">
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-border/50 bg-card p-6 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Subscription Status
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isSubscriptionActive
                      ? "animate-pulse bg-chart-3"
                      : "bg-destructive"
                  }`}
                />
                <p className="text-xl font-semibold">{subscriptionLabel}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {subscription?.plan_type
                  ? `${subscription.plan_type} plan`
                  : "No plan selected"}
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-border/50 bg-card p-6 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Quick Actions
              </p>
              <div className="relative z-10 mt-4 grid grid-cols-1 gap-2">
                <Link
                  href="/dashboard/scores"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  Enter Scores
                </Link>
                <Link
                  href="/dashboard/charity"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Charity Impact
                </Link>
              </div>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-xl border border-border/50 bg-card p-6 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Winnings
              </p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-primary">
                ${totalWinnings.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Across all draw outcomes.
              </p>
            </motion.article>
          </section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-xl border border-border/50 bg-card p-6 shadow-sm md:col-span-2"
          >
            <h2 className="text-xl font-semibold">Recent Performance</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your latest five rounds at a glance.
            </p>

            {scores.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No scores yet. Add your first score in the action zone.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {scores.map((item, index) => (
                  <li key={item.id}>
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.06 * index }}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                          {item.score}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Round {index + 1}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.date_played}
                      </span>
                    </motion.div>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          <motion.section
            id="settings"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="rounded-xl border border-border/50 bg-card p-6 shadow-sm md:col-span-1"
          >
            <h3 className="text-lg font-semibold">Payout Center</h3>

            {latestDraw && isLatestDrawWinner ? (
              <div className="mt-3 space-y-3">
                <p className="text-lg font-bold text-chart-2">
                  🎉 Congratulations! You matched {pendingWinner?.match_type}{" "}
                  numbers and won ${pendingWinner?.prize_amount}!
                </p>
                <p className="text-sm text-muted-foreground">
                  Verification is pending. Use the alert at the top of the
                  dashboard to submit your proof.
                </p>
                {pendingWinner?.proof_image_url ? (
                  <a
                    href={pendingWinner.proof_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex font-medium text-primary hover:text-primary/80"
                  >
                    View uploaded proof
                  </a>
                ) : null}
              </div>
            ) : latestDraw ? (
              <p className="mt-3 text-sm text-muted-foreground">
                You didn't have a winning match this round. Your next 5 rounds
                could be the lucky ones!
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No official draw has been published yet.
              </p>
            )}
          </motion.section>
        </div>
      )}
    </div>
  );
}
