"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
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
  draw?: {
    status?: string | null;
  } | null;
};

type ScoreApiResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  scores?: ScoreRow[];
};

type WinnerAmountRow = {
  prize_amount: number;
  draw?: {
    status?: string | null;
  } | null;
};

type SystemSettingsRow = {
  current_jackpot_rollover: number;
};

const todayIso = new Date().toISOString().slice(0, 10);

function DashboardPageContent() {
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
  const [proofUploadToastMessage, setProofUploadToastMessage] = useState<
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
    if (!proofUploadToastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setProofUploadToastMessage(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [proofUploadToastMessage]);

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
              "id, draw_id, match_type, prize_amount, payment_status, proof_image_url, draw:draws!inner(status)",
            )
            .eq("user_id", user.id)
            .eq("payment_status", "pending")
            .eq("draws.status", "published")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("winners")
            .select("prize_amount, draw:draws!inner(status)")
            .eq("user_id", user.id)
            .eq("draws.status", "published"),
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

    try {
      setIsUploadingProof(true);

      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("user_id", userId);
      formData.append("winner_id", pendingWinner.id);

      const uploadResponse = await fetch("/api/winners/upload-proof", {
        method: "POST",
        body: formData,
      });

      const uploadPayload = (await uploadResponse.json()) as {
        success?: boolean;
        error?: string;
        publicUrl?: string;
      };

      if (
        !uploadResponse.ok ||
        !uploadPayload.success ||
        !uploadPayload.publicUrl
      ) {
        throw new Error(
          uploadPayload.error ?? "Failed to upload verification proof.",
        );
      }

      const proofUrl = uploadPayload.publicUrl;

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
      setProofUploadToastMessage("Verification proof uploaded successfully.");
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
  const hasPendingWinner =
    pendingWinner?.payment_status === "pending" &&
    !pendingWinner?.proof_image_url;
  const isLatestDrawWinner = Boolean(
    latestDraw && pendingWinner && pendingWinner.draw_id === latestDraw.id,
  );
  const currentMonthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedPlanLabel = subscription?.plan_type
    ? `${subscription.plan_type[0].toUpperCase()}${subscription.plan_type.slice(1)} Plan`
    : "No active plan";

  return (
    <div className="space-y-6 text-foreground">
      {checkoutToastMessage ? (
        <div className="fixed bottom-3 left-3 right-3 z-50 rounded-xl border border-chart-3/40 bg-card/95 px-4 py-3 text-sm text-foreground shadow-xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
          <p className="font-semibold text-chart-3">Billing Success</p>
          <p className="mt-1 text-muted-foreground">{checkoutToastMessage}</p>
        </div>
      ) : null}

      {proofUploadToastMessage ? (
        <div className="fixed bottom-20 left-3 right-3 z-50 rounded-xl border border-emerald-300/60 bg-emerald-600/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur sm:bottom-24 sm:left-auto sm:right-4 sm:max-w-sm">
          <p className="font-semibold">Proof Submitted</p>
          <p className="mt-1 text-white/90">{proofUploadToastMessage}</p>
        </div>
      ) : null}

      {/* Illustration Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-r from-primary/10 via-background to-chart-2/10 p-4 shadow-sm sm:p-6 md:p-8"
      >
        <div className="absolute inset-0 opacity-15">
          <Image
            src="/illustration.png"
            alt="Golf Impact illustration"
            fill
            loading="eager"
            className="object-cover"
          />
        </div>
        <div
          className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-primary/15 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-chart-2/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
          <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Image
              src="/logoV1.png"
              alt="Golf Impact illustration"
              width={100}
              height={100}
              className="h-20 w-20 rounded-2xl object-contain sm:h-auto sm:w-auto"
            />
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Dashboard Overview
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Your Golf Impact Hub
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Every swing counts. Every score matters.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <WinnerVerificationAlert
        isVisible={Boolean(hasPendingWinner)}
        pendingPrizeAmount={pendingWinner?.prize_amount}
        isUploading={isUploadingProof}
        selectedFileName={proofFile?.name ?? null}
        selectedFileSizeBytes={proofFile?.size ?? null}
        onFileChange={setProofFile}
        onSubmit={handleProofUpload}
      />

      <section className="rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur-sm sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Draw Cycle
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {currentMonthLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Membership
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {selectedPlanLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Beneficiary
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {selectedCharity?.name ?? "Not selected yet"}
            </p>
          </div>
        </div>
      </section>

      {/* Browse Charities Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-accent/40 bg-linear-to-r from-accent/10 to-primary/5 p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Explore Impact Partners
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover and select verified charities that align with your
              values.
            </p>
          </div>
          <Link
            href="/charities"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Browse Charities
            <span>→</span>
          </Link>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActiveDrawStatus
            isSubscribed={subscription?.status === "active"}
            scoreCount={scores.length}
            currentJackpot={currentJackpot}
          />

          <section className="rounded-2xl border border-primary/70 bg-card p-4 shadow-[0_0_38px_-10px_hsl(var(--primary))] sm:p-6">
            {latestDraw ? (
              <>
                <div className="mb-2 flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <h2 className="text-xl font-semibold">Latest Draw Results</h2>
                  <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-background/50 p-1.5 sm:w-24">
                    <Image
                      src="/result.png"
                      alt="Latest draw results"
                      width={120}
                      height={80}
                      className="h-20 w-24 object-contain"
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Draw Date:{" "}
                  {new Date(latestDraw.draw_date).toLocaleDateString()}
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
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/90 font-bold text-primary-foreground"
                      >
                        {number}
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : (
              <div>
                <div className="mb-2 flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <h2 className="text-xl font-semibold">Latest Draw Results</h2>
                  <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-background/50 p-1.5 sm:w-24">
                    <Image
                      src="/result.png"
                      alt="Latest draw results"
                      width={120}
                      height={80}
                      className="h-20 w-24 object-contain"
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Waiting for the next official draw to be published. Submit
                  your scores now!
                </p>
              </div>
            )}
          </section>
        </section>
      </div>

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
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-muted-foreground shadow-sm">
          Loading dashboard...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          <section className="grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3">
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-primary/8 sm:p-6"
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
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-primary/8 sm:p-6"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Quick Actions
              </p>
              <div className="relative z-10 mt-4 grid grid-cols-1 gap-2">
                <Link
                  href="/dashboard/scores"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  Enter Scores
                </Link>
                <Link
                  href="/dashboard/charity"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-muted"
                >
                  Charity Impact
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-muted"
                >
                  Billing & Plan
                </Link>
              </div>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-primary/8 sm:p-6"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Winnings
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
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
            className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-primary/8 sm:p-6 md:col-span-2"
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/25 bg-primary/90 text-sm font-semibold text-primary-foreground">
                          {item.score}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Round {index + 1}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date_played).toLocaleDateString()}
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
            className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-primary/8 sm:p-6 md:col-span-1"
          >
            <h3 className="text-lg font-semibold">Payout Center</h3>

            {latestDraw && isLatestDrawWinner ? (
              <div className="mt-3 space-y-4">
                <div className="rounded-xl border border-emerald-300/40 bg-linear-to-br from-emerald-500/15 via-background to-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Winning Draw Confirmed
                  </p>
                  <h4 className="mt-1 text-lg font-bold text-foreground">
                    You matched {pendingWinner?.match_type} numbers
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prize amount:
                    <span className="ml-1 font-semibold text-foreground">
                      ${Number(pendingWinner?.prize_amount ?? 0).toFixed(2)}
                    </span>
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-sm text-muted-foreground">
                    {pendingWinner?.proof_image_url
                      ? "Your proof has been submitted and is awaiting final admin review."
                      : "Verification is pending. Submit your proof using the verification card below Dashboard Overview to complete payout processing."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Payout Status: Pending
                  </span>
                  {pendingWinner?.proof_image_url ? (
                    <a
                      href={pendingWinner.proof_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                    >
                      View Uploaded Proof
                    </a>
                  ) : null}
                </div>
              </div>
            ) : latestDraw ? (
              <div className="mt-3 space-y-3">
                <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-3">
                  <Image
                    src="/empty.png"
                    alt="No winning match"
                    width={600}
                    height={400}
                    className="h-auto w-full rounded-lg object-contain"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  You didn't have a winning match this round. Your next 5 rounds
                  could be the lucky ones!
                </p>
              </div>
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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-muted-foreground shadow-sm">
          Loading dashboard...
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
