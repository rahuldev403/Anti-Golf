"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

type ActiveDrawStatusProps = {
  isSubscribed: boolean;
  scoreCount: number;
  currentJackpot: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function clampScoreCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.floor(value)));
}

export default function ActiveDrawStatus({
  isSubscribed,
  scoreCount,
  currentJackpot,
}: ActiveDrawStatusProps) {
  const safeScoreCount = clampScoreCount(scoreCount);
  const remainingScores = Math.max(0, 5 - safeScoreCount);

  const handleViewPlans = () => {
    const billingSection = document.getElementById("billing-section");
    if (billingSection) {
      billingSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.href = "/dashboard/billing";
  };

  const handleLogScore = () => {
    const scoreForm = document.getElementById("score-entry-form");
    if (scoreForm) {
      scoreForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.href = "/dashboard/scores";
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-primary/50 bg-linear-to-br from-sidebar to-background p-6 shadow-[0_0_35px_-12px_hsl(var(--primary))]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-3 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-chart-3" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Upcoming Monthly Draw
            </p>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Estimated Jackpot
          </p>
          <p className="mt-1 text-4xl font-black tracking-tight text-primary sm:text-5xl">
            {formatCurrency(currentJackpot)}
          </p>
        </div>

        <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-background/50 p-1.5">
          <Image
            src="/draw1.png"
            alt="Upcoming monthly draw"
            width={120}
            height={80}
            className="h-20 w-24 object-contain"
          />
        </div>
      </div>

      {!isSubscribed ? (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                You are currently spectating. Subscribe to unlock the draw and
                play for the jackpot!
              </p>
              <button
                type="button"
                onClick={handleViewPlans}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
              >
                View Subscription Plans
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSubscribed && safeScoreCount < 5 ? (
        <div className="mt-6 rounded-xl border border-accent/40 bg-accent/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 text-accent-foreground" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                Action Required: You need 5 logged scores to qualify for this
                month's draw. You currently have {safeScoreCount}. Log{" "}
                {remainingScores} more scores!
              </p>
              <button
                type="button"
                onClick={handleLogScore}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-110"
              >
                Log a Score Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSubscribed && safeScoreCount === 5 ? (
        <div className="mt-6 rounded-xl border border-chart-3/40 5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-7 w-7 text-primary" />
            <p className="text-sm font-semibold text-primary">
              You are fully qualified! Your latest 5 scores are locked in for
              the upcoming draw.
            </p>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}
