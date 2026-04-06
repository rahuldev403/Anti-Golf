"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../../../utils/supabase/client";

type SubscriptionRow = {
  status: "active" | "inactive";
  plan_type: "monthly" | "yearly";
};

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSubscription, setIsFetchingSubscription] = useState(true);
  const [planType, setPlanType] = useState<"monthly" | "yearly">("monthly");
  const [activeSubscription, setActiveSubscription] =
    useState<SubscriptionRow | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const hasActiveSubscription = activeSubscription?.status === "active";
  const showUpgradeError =
    searchParams.get("error") === "upgrade_required" && !hasActiveSubscription;

  useEffect(() => {
    const loadSubscription = async () => {
      if (!supabase) {
        setSubscriptionError("Supabase client is unavailable.");
        setIsFetchingSubscription(false);
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setSubscriptionError(
            "You must be signed in to view billing details.",
          );
          return;
        }

        const { data, error } = await supabase
          .from("subscriptions")
          .select("status, plan_type")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1);

        if (error) {
          throw new Error(error.message);
        }

        const active = ((data ?? []) as SubscriptionRow[])[0] ?? null;
        setActiveSubscription(active);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load subscription details.";
        setSubscriptionError(message);
      } finally {
        setIsFetchingSubscription(false);
      }
    };

    void loadSubscription();
  }, [supabase]);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });

      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to create checkout session.");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open checkout.";
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-r from-primary/10 via-background to-chart-2/10 p-4 shadow-sm sm:p-6">
        <div
          className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-chart-2/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Billing & Subscription
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Choose your plan and keep your score entry, draw participation, and
            impact tools active.
          </p>
        </div>
      </header>

      {showUpgradeError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Premium access is required to enter scores. Please upgrade your
          subscription.
        </div>
      ) : null}

      {subscriptionError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {subscriptionError}
        </div>
      ) : null}

      {isFetchingSubscription ? (
        <article className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Loading your subscription...
          </p>
        </article>
      ) : null}

      {!isFetchingSubscription && hasActiveSubscription ? (
        <article className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div className="rounded-2xl border border-chart-3/35 bg-chart-3/10 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-chart-3">
              Active Subscription
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {activeSubscription?.plan_type === "yearly"
                ? "Yearly Premium Plan"
                : "Monthly Premium Plan"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your premium subscription is currently active. Billing and draw
              access are enabled on your account.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-xl font-semibold text-primary">
              {activeSubscription?.plan_type === "yearly"
                ? "Rs 7,999 / year"
                : "Rs 899 / month"}
            </p>
          </div>
        </article>
      ) : null}

      {!isFetchingSubscription && !hasActiveSubscription ? (
        <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Premium Access Plans</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the plan that best fits your playing frequency.
              </p>
            </div>

            <div className="inline-flex w-full rounded-lg border border-border/70 bg-muted/50 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setPlanType("monthly")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition sm:flex-none ${
                  planType === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPlanType("yearly")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition sm:flex-none ${
                  planType === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPlanType("monthly")}
              className={`rounded-2xl border p-5 text-left transition ${
                planType === "monthly"
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-background hover:border-primary/35"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Monthly Plan
              </p>
              <p className="mt-2 text-2xl font-semibold text-primary">Rs 899</p>
              <p className="mt-1 text-sm text-muted-foreground">per month</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Flexible billing for players who want month-to-month access.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPlanType("yearly")}
              className={`rounded-2xl border p-5 text-left transition ${
                planType === "yearly"
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-background hover:border-primary/35"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Yearly Plan
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-primary">
                    Rs 7,999
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">per year</p>
                </div>
                <span className="rounded-full border border-chart-3/40 bg-chart-3/15 px-2 py-1 text-xs font-semibold text-chart-3">
                  Best Value
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Save more with annual access and uninterrupted participation.
              </p>
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Selected plan</p>
              <p className="text-xl font-semibold text-primary">
                {planType === "monthly" ? "Rs 899 / month" : "Rs 7,999 / year"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isLoading ? "Redirecting..." : "Continue to Checkout"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Loading billing details...
          </p>
        </section>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
