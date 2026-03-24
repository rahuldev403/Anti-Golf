"use client";

import { motion } from "framer-motion";

type LatestDraw = {
  winning_numbers: number[];
  total_prize_pool: number;
  draw_date: string;
};

type JackpotBannerProps = {
  latestDraw: LatestDraw | null;
  currentJackpot: number;
  isSubscribed: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function JackpotBanner({
  latestDraw,
  currentJackpot,
  isSubscribed,
}: JackpotBannerProps) {
  const handleViewPlans = () => {
    const billingSection = document.getElementById("billing-section");
    if (billingSection) {
      billingSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.href = "/dashboard/billing";
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-primary/50 bg-linear-to-r from-primary/20 via-accent/10 to-background"
    >
      <div className="grid gap-6 p-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            Next Month's Jackpot Rollover
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight text-primary drop-shadow-[0_0_24px_rgba(99,102,241,0.45)] sm:text-5xl">
            {formatCurrency(currentJackpot)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Build momentum now and compete for the next rollover-backed draw.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/65 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Last Draw Results
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(latestDraw?.winning_numbers ?? []).length > 0 ? (
              latestDraw?.winning_numbers.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                >
                  {value}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                Winning numbers not available yet.
              </span>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Date:{" "}
            {latestDraw?.draw_date ? formatDate(latestDraw.draw_date) : "TBD"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pool: {formatCurrency(latestDraw?.total_prize_pool ?? 0)}
          </p>
        </div>
      </div>

      {!isSubscribed ? (
        <div className="flex flex-col items-start justify-between gap-3 border-t border-primary/30 bg-primary/10 px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-foreground">
            You missed the last draw! Subscribe now to lock your numbers in for
            the next jackpot.
          </p>
          <button
            type="button"
            onClick={handleViewPlans}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            View Plans
          </button>
        </div>
      ) : null}
    </motion.section>
  );
}
