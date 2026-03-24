"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient as createSupabaseClient } from "../utils/supabase/client";

type FeaturedCharity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.15,
    },
  },
};

const steps = [
  {
    title: "Subscribe",
    description:
      "Choose your plan and instantly unlock a purpose-driven experience built for consistency and impact.",
    icon: "/icons/subscribe.png",
  },
  {
    title: "Enter Scores",
    description:
      "Log each round in seconds, monitor your improvement, and build momentum through transparent tracking.",
    icon: "/icons/scores.png",
  },
  {
    title: "Win & Give Back",
    description:
      "Compete for rewards while a share of every subscription supports vetted charities you care about.",
    icon: "/icons/give-back.png",
  },
];

const heroSlides = [
  {
    title: "Track Progress With Precision",
    description:
      "Log rounds instantly and monitor your long-term trend with confidence.",
    image: "/hero-image.jpeg",
    objectPosition: "object-center",
  },
  {
    title: "Compete For Meaningful Rewards",
    description:
      "Every submitted score keeps you in the draw and connected to monthly wins.",
    image: "/hero-image2.jpg",
    objectPosition: "object-left",
  },
  {
    title: "Fund The Causes You Care About",
    description:
      "A share of every subscription is routed to your selected charity impact.",
    image: "/hero-image3.jpg",
    objectPosition: "object-right",
  },
];

export default function Page() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [featuredCharity, setFeaturedCharity] =
    useState<FeaturedCharity | null>(null);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(true);

  const supabase = useMemo(() => {
    try {
      return createSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const redirectByRole = async () => {
    if (!supabase) {
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const { error: createProfileError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          role: "user",
        });

      if (createProfileError) {
        await supabase.auth.signOut();
        return;
      }

      router.replace("/dashboard");
      return;
    }

    if (profile?.role === "admin") {
      router.replace("/admin");
      return;
    }

    router.replace("/dashboard");
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((previous) => (previous + 1) % heroSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void redirectByRole();
  }, [supabase]);

  useEffect(() => {
    const loadFeaturedCharity = async () => {
      if (!supabase) {
        setIsFeaturedLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("charities")
        .select("id, name, description, image_url")
        .eq("is_featured", true)
        .limit(1)
        .maybeSingle();

      if (!error) {
        setFeaturedCharity((data as FeaturedCharity | null) ?? null);
      }

      setIsFeaturedLoading(false);
    };

    void loadFeaturedCharity();
  }, [supabase]);

  useEffect(() => {
    if (!isAuthModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAuthModalOpen(false);
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isAuthModalOpen]);

  const goToSlide = (index: number) => {
    setActiveSlide(index);
  };

  const goToPrevious = () => {
    setActiveSlide((previous) =>
      previous === 0 ? heroSlides.length - 1 : previous - 1,
    );
  };

  const goToNext = () => {
    setActiveSlide((previous) => (previous + 1) % heroSlides.length);
  };

  const featuredExcerpt = featuredCharity?.description?.trim()
    ? featuredCharity.description.length > 220
      ? `${featuredCharity.description.slice(0, 219).trimEnd()}...`
      : featuredCharity.description
    : "This impact partner is transforming lives through practical, measurable programs that deserve your support.";

  const openAuthModal = () => {
    setAuthError(null);
    setMode("signup");
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);

    if (!supabase) {
      const message =
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    if (!email.trim()) {
      const message = "Email is required.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    if (password.length < 6) {
      const message = "Password must be at least 6 characters.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    try {
      setAuthLoading(true);

      if (mode === "signup") {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin;
        const emailRedirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback`;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.session) {
          toast.success(
            "Signup request accepted. If the email is valid, check inbox/spam for the verification link.",
          );
          setMode("signin");
          setPassword("");
          return;
        }

        toast.success("Account created successfully.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        toast.success("Signed in successfully.");
      }

      setIsAuthModalOpen(false);
      await redirectByRole();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed.";
      setAuthError(message);
      toast.error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-20rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-12rem] top-1/3 h-[30rem] w-[30rem] rounded-full bg-chart-3/15 blur-3xl" />
        <div className="absolute left-[-16rem] bottom-[-8rem] h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <section className="relative w-full overflow-hidden">
        <motion.div
          key={activeSlide}
          initial={{ opacity: 0.25, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative"
        >
          <Image
            src={heroSlides[activeSlide].image}
            alt={heroSlides[activeSlide].title}
            width={2200}
            height={1300}
            priority
            className={`h-[70vh] min-h-[520px] w-full object-cover ${heroSlides[activeSlide].objectPosition}`}
          />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-background/40 backdrop-blur-[3px]" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-background/85 via-background/35 to-primary/20" />

        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 md:px-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mx-auto max-w-3xl text-center"
          >
            <motion.p
              variants={fadeUp}
              className="inline-flex items-center rounded-full border border-primary/30 bg-background/35 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-sm"
            >
              Performance With Purpose
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="mt-4 text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              Track Every Win.
              <br className="hidden sm:block" />
              Transform Every Score Into Support.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              A premium subscription platform where your personal progress fuels
              real-world change. Improve your game, stay accountable, and direct
              meaningful donations to trusted charities every month.
            </motion.p>

            <motion.div variants={fadeUp} className="pt-6">
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-[1.02] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Subscribe Now
              </button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/45 p-4 backdrop-blur-sm sm:grid-cols-3"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Monthly Draw
                </p>
                <p className="mt-1 text-lg font-semibold">5 Chances</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Real Impact
                </p>
                <p className="mt-1 text-lg font-semibold">Charity Routed</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Your Progress
                </p>
                <p className="mt-1 text-lg font-semibold">Live Tracking</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <button
          type="button"
          aria-label="Previous slide"
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-foreground backdrop-blur-sm transition hover:bg-background"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={goToNext}
          className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-foreground backdrop-blur-sm transition hover:bg-background"
        >
          ›
        </button>

        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => goToSlide(index)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                index === activeSlide
                  ? "bg-primary"
                  : "bg-muted-foreground/45 hover:bg-muted-foreground/75"
              }`}
            />
          ))}
        </div>
      </section>

      {!isFeaturedLoading ? (
        <section className="mx-auto w-full max-w-7xl px-6 pb-20 md:px-10">
          <div className="relative overflow-hidden rounded-4xl border border-primary/25 bg-linear-to-br from-primary/10 via-card to-background p-2">
            <div className="grid grid-cols-1 overflow-hidden rounded-[1.6rem] border border-border/50 bg-background/70 backdrop-blur-sm lg:grid-cols-2">
              <div className="relative h-88 lg:h-full lg:min-h-120">
                {featuredCharity?.image_url ? (
                  <Image
                    src={featuredCharity.image_url}
                    alt={featuredCharity.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-linear-to-br from-primary/25 via-accent/15 to-card" />
                )}

                <div className="absolute inset-0 bg-linear-to-r from-black/30 via-black/10 to-transparent" />
                <div className="absolute -bottom-10 left-6 right-6 rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md lg:hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                    Featured Impact Partner
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {featuredCharity?.name ?? "Feature Coming Soon"}
                  </h3>
                </div>
              </div>

              <div className="relative flex items-center px-6 pb-8 pt-16 sm:px-8 lg:px-10 lg:py-12">
                <div className="absolute -left-16 top-12 hidden h-40 w-40 rounded-full bg-primary/25 blur-3xl lg:block" />
                <div className="absolute bottom-8 right-8 hidden h-28 w-28 rounded-full border border-primary/25 bg-primary/10 backdrop-blur-sm lg:block" />

                <div className="relative w-full rounded-2xl border border-border/40 bg-card/70 p-6 shadow-xl shadow-primary/10 backdrop-blur-md sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Featured Impact Partner
                  </p>
                  <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                    {featuredCharity?.name ?? "Spotlight Charity"}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {featuredExcerpt}
                  </p>

                  {featuredCharity ? (
                    <Link
                      href={`/charities/${featuredCharity.id}`}
                      className="mt-7 inline-flex items-center justify-center rounded-xl bg-linear-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:brightness-110"
                    >
                      Support {featuredCharity.name} Today
                    </Link>
                  ) : (
                    <p className="mt-7 inline-flex rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                      Featured charity will be announced shortly.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-6 pb-24 md:px-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2
            variants={fadeUp}
            className="text-2xl font-semibold text-foreground sm:text-3xl"
          >
            How It Works
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-2xl text-muted-foreground"
          >
            Three seamless steps connect your improvement journey to measurable
            social impact.
          </motion.p>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <motion.article
                key={step.title}
                variants={fadeUp}
                className="rounded-2xl border border-border/70 bg-card/80 p-6 transition hover:-translate-y-1 hover:border-primary/50"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-primary/30 bg-muted/80">
                  <Image
                    src={step.icon}
                    alt={`${step.title} icon`}
                    width={30}
                    height={30}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </section>

      {isAuthModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-md"
          onClick={closeAuthModal}
          role="presentation"
        >
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-xl rounded-2xl border border-primary/25 bg-card/95 p-6 shadow-2xl shadow-primary/15"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">
                  {mode === "signup" ? "Create Your Account" : "Welcome Back"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mode === "signup"
                    ? "Start with email and password. We will send a verification link to your inbox."
                    : "Sign in to access your dashboard, scores, and prize workflow."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
                aria-label="Close authentication modal"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 rounded-lg border border-border/70 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Create Account
              </button>
            </div>

            {authError ? (
              <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {authError}
              </p>
            ) : null}

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-20 text-sm outline-none transition focus:border-ring"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={authLoading}
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? mode === "signin"
                    ? "Signing In..."
                    : "Creating Account..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>
          </motion.section>
        </div>
      ) : null}
    </main>
  );
}
