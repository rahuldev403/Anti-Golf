"use client";

import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CharitiesFooter } from "../components/charities-footer";
import { createClient as createSupabaseClient } from "../../../utils/supabase/client";
import CharityImage from "../../components/CharityImage";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  upcoming_events: unknown;
};

type UpcomingEvent = {
  title: string;
  date: string;
  location: string;
  description: string;
};

type OneOffCheckoutResponse = {
  url?: string;
  error?: string;
};

const timelineContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const timelineItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

function formatDateLabel(value: string): string {
  if (!value) {
    return "Date to be announced";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseUpcomingEvents(value: unknown): UpcomingEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          title: `Community Event ${index + 1}`,
          date: "",
          location: "Details coming soon",
          description: item,
        } satisfies UpcomingEvent;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const event = item as Record<string, unknown>;
      const title =
        typeof event.title === "string" && event.title.trim().length > 0
          ? event.title.trim()
          : `Community Event ${index + 1}`;

      const date = typeof event.date === "string" ? event.date : "";
      const location =
        typeof event.location === "string" && event.location.trim().length > 0
          ? event.location.trim()
          : "Location to be confirmed";

      const description =
        typeof event.description === "string" &&
        event.description.trim().length > 0
          ? event.description.trim()
          : "More details will be shared soon.";

      return {
        title,
        date,
        location,
        description,
      } satisfies UpcomingEvent;
    })
    .filter((event): event is UpcomingEvent => Boolean(event));
}

function getParamId(rawId: string | string[] | undefined): string | null {
  if (!rawId) {
    return null;
  }

  if (Array.isArray(rawId)) {
    return rawId[0] ?? null;
  }

  return rawId;
}

export default function CharityDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = getParamId(params?.id as string | string[] | undefined);
  const charityId = rawId ? decodeURIComponent(rawId) : null;

  const [charity, setCharity] = useState<Charity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSelectingBeneficiary, setIsSelectingBeneficiary] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationAmountInr, setDonationAmountInr] = useState(1000);
  const [isCreatingDonation, setIsCreatingDonation] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const loadCharity = async () => {
      if (!charityId) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setErrorMessage("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setIsNotFound(false);

      const withEvents = await supabase
        .from("charities")
        .select("id, name, description, image_url, upcoming_events")
        .eq("id", charityId)
        .maybeSingle();

      if (!withEvents.error) {
        setCharity((withEvents.data as Charity | null) ?? null);
        setIsNotFound(!withEvents.data);
        setIsLoading(false);
        return;
      }

      const withoutEvents = await supabase
        .from("charities")
        .select("id, name, description, image_url")
        .eq("id", charityId)
        .maybeSingle();

      if (withoutEvents.error) {
        setErrorMessage(
          `Failed to load charity: ${withoutEvents.error.message}`,
        );
        setIsLoading(false);
        return;
      }

      const fallback = withoutEvents.data
        ? ({
            ...(withoutEvents.data as Omit<Charity, "upcoming_events">),
            upcoming_events: [],
          } satisfies Charity)
        : null;

      setCharity(fallback);
      setIsNotFound(!fallback);
      setIsLoading(false);
    };

    void loadCharity();
  }, [charityId, supabase]);

  const upcomingEvents = useMemo(
    () => parseUpcomingEvents(charity?.upcoming_events),
    [charity?.upcoming_events],
  );

  const handleSelectBeneficiary = async () => {
    setActionMessage(null);

    if (!supabase || !charityId) {
      setActionMessage("Unable to update beneficiary right now.");
      return;
    }

    try {
      setIsSelectingBeneficiary(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setActionMessage("Please sign in to select a charity beneficiary.");
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({ selected_charity_id: charityId })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setActionMessage("This charity is now your subscription beneficiary.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to set selected beneficiary.";
      setActionMessage(message);
    } finally {
      setIsSelectingBeneficiary(false);
    }
  };

  const handleOneOffDonation = async () => {
    if (!charityId) {
      return;
    }

    try {
      setIsCreatingDonation(true);

      const response = await fetch("/api/checkout/one-off", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          charityId,
          amountInr: donationAmountInr,
        }),
      });

      const payload = (await response.json()) as OneOffCheckoutResponse;

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to create one-off checkout.");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start one-off donation checkout.";
      setActionMessage(message);
      setIsCreatingDonation(false);
      setShowDonationModal(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-2xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
          Loading charity profile...
        </div>
      </main>
    );
  }

  if (isNotFound || !charity) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold">Charity not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The profile you are trying to view does not exist or is no longer
            available.
          </p>
          <button
            type="button"
            onClick={() => router.push("/charities")}
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Back to Directory
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative h-[48vh] min-h-75 w-full sm:h-[56vh]">
        {charity.image_url ? (
          <CharityImage
            src={charity.image_url}
            alt={charity.name}
            loading="eager"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-primary/15 via-accent/10 to-card" />
        )}

        <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-10 lg:pb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/85">
            Charity Profile
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-white drop-shadow sm:text-5xl">
            {charity.name}
          </h1>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
        <article className="space-y-7">
          <button
            type="button"
            onClick={() => router.push("/charities")}
            className="inline-flex items-center rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            Back to Charity Directory
          </button>

          {errorMessage ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold sm:text-2xl">
              About This Cause
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
              {charity.description?.trim() ||
                "This organization is focused on measurable social impact. Detailed description will be available shortly."}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold sm:text-2xl">
              Upcoming Events
            </h2>

            {upcomingEvents.length > 0 ? (
              <motion.ol
                variants={timelineContainer}
                initial="hidden"
                animate="show"
                className="mt-5 space-y-4"
              >
                {upcomingEvents.map((event, index) => (
                  <motion.li
                    key={`${event.title}-${event.date}-${index}`}
                    variants={timelineItem}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="rounded-xl border border-border/60 bg-background p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {formatDateLabel(event.date)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold">
                      {event.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.location}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {event.description}
                    </p>
                  </motion.li>
                ))}
              </motion.ol>
            ) : (
              <div className="mt-5 rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                No upcoming events published yet.
              </div>
            )}
          </div>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Take Action</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose how you want to support this charity right now.
            </p>

            {actionMessage ? (
              <div className="mt-4 rounded-lg border border-border/70 bg-background p-3 text-sm text-muted-foreground">
                {actionMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSelectBeneficiary}
              disabled={isSelectingBeneficiary}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSelectingBeneficiary
                ? "Saving beneficiary..."
                : "Select as my Subscription Beneficiary"}
            </button>

            <button
              type="button"
              onClick={() => setShowDonationModal(true)}
              className="mt-3 w-full rounded-lg border border-border/70 bg-background px-4 py-2.5 text-sm font-semibold transition hover:border-primary/50 hover:text-primary"
            >
              Make a One-Off Donation
            </button>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Donations are processed securely through Stripe. You can support
              once or set this charity as your monthly beneficiary.
            </p>
          </div>
        </aside>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-10">
        <CharitiesFooter />
      </div>

      {showDonationModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
            <h2 className="text-xl font-semibold">One-Off Donation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select an amount and continue to Stripe secure checkout.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[500, 1000, 2500].map((value) => {
                const isActive = donationAmountInr === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDonationAmountInr(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Rs {value}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDonationModal(false)}
                disabled={isCreatingDonation}
                className="flex-1 rounded-lg border border-border/70 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOneOffDonation}
                disabled={isCreatingDonation}
                className="flex-1 rounded-lg bg-linear-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingDonation ? "Redirecting..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
