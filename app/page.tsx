"use client";

import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  Target,
  Mail,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient as createSupabaseClient } from "../utils/supabase/client";

type FeaturedCharity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

type SignupCharityOption = {
  id: string;
  name: string;
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
    icon: "/icons/subscribe1.png",
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
    icon: "/icons/give-back1.png",
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
  const [signupCharities, setSignupCharities] = useState<SignupCharityOption[]>(
    [],
  );
  const [selectedSignupCharityId, setSelectedSignupCharityId] = useState("");
  const [signupCharityPercent, setSignupCharityPercent] = useState(10);

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
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const selectedCharityId =
        typeof metadata.selected_charity_id === "string" &&
        metadata.selected_charity_id.trim().length > 0
          ? metadata.selected_charity_id.trim()
          : null;
      const rawContribution = Number(metadata.charity_percentage ?? 10);
      const safeContribution = Number.isFinite(rawContribution)
        ? Math.min(50, Math.max(10, Math.round(rawContribution)))
        : 10;

      const { error: createProfileError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          role: "user",
          selected_charity_id: selectedCharityId,
          charity_percentage: safeContribution,
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
    const loadSignupCharities = async () => {
      if (!supabase) {
        return;
      }

      const response = await fetch("/api/public/charities", {
        method: "GET",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        success?: boolean;
        charities?: SignupCharityOption[];
      };

      if (!payload.success || !Array.isArray(payload.charities)) {
        return;
      }

      const options = payload.charities.filter(
        (charity) => Boolean(charity.id) && Boolean(charity.name),
      );

      setSignupCharities(options);
      setSelectedSignupCharityId(
        (previous) => previous || options[0]?.id || "",
      );
    };

    void loadSignupCharities();
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
  const currentYear = new Date().getFullYear();

  const openAuthModal = () => {
    setAuthError(null);
    setMode("signup");
    if (!selectedSignupCharityId && signupCharities.length > 0) {
      setSelectedSignupCharityId(signupCharities[0].id);
    }
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

    if (mode === "signup") {
      if (!selectedSignupCharityId) {
        const message = "Please select a charity for your contribution.";
        setAuthError(message);
        toast.error(message);
        return;
      }

      if (!Number.isFinite(signupCharityPercent) || signupCharityPercent < 10) {
        const message = "Contribution must be at least 10%.";
        setAuthError(message);
        toast.error(message);
        return;
      }
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
            data: {
              selected_charity_id: selectedSignupCharityId,
              charity_percentage: Math.min(
                50,
                Math.max(10, signupCharityPercent),
              ),
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.session && data.user) {
          toast.success("Account created successfully.");
        } else {
          toast.success(
            "Signup request accepted. If the email is valid, check inbox/spam for the verification link.",
          );
          setMode("signin");
          setPassword("");
          return;
        }
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
    <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 -top-80 h-168 w-2xl -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-48 top-1/3 h-120 w-120 rounded-full bg-chart-3/15 blur-3xl" />
        <div className="absolute -left-64 -bottom-32 h-104 w-104 rounded-full bg-accent/20 blur-3xl" />
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
            className={`h-[70vh] min-h-130 w-full object-cover ${heroSlides[activeSlide].objectPosition}`}
          />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-background/40 backdrop-blur-[3px]" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-background/85 via-background/35 to-primary/20" />

        <div className="absolute inset-0 z-10 flex items-start justify-center px-6 pb-32 pt-1 sm:pt-4 md:px-10 md:pt-7 lg:pt-11">
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
              className="mt-2 text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              Track Every Win.
              <br className="hidden sm:block" />
              Transform Every Score Into Support.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              A premium subscription platform where your personal progress fuels
              real-world change. Improve your game, stay accountable, and direct
              meaningful donations to trusted charities every month.
            </motion.p>

            <motion.div variants={fadeUp} className="pt-3">
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-[1.02] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Subscribe Now
              </button>
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
      </section>

      {!isFeaturedLoading ? (
        <motion.section
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto w-full max-w-7xl px-6 py-16 md:px-10 lg:py-20"
        >
          <div className="relative overflow-hidden rounded-4xl border border-primary/25 bg-linear-to-br from-primary/10 via-card to-background p-2">
            <div className="grid grid-cols-1 overflow-hidden rounded-[1.6rem] border border-border/50 bg-background/70 backdrop-blur-sm lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                viewport={{ once: true, amount: 0.5 }}
                className="relative h-88 lg:h-full lg:min-h-120"
              >
                <Image
                  src="/charity1.jpg"
                  alt="Featured charity supporting real-world impact"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />

                <div className="absolute inset-0 bg-linear-to-r from-black/30 via-black/10 to-transparent" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                viewport={{ once: true, amount: 0.5 }}
                className="relative flex items-center px-6 pb-8 pt-16 sm:px-8 lg:px-10 lg:py-12"
              >
                <div className="absolute -left-16 top-12 hidden h-40 w-40 rounded-full bg-primary/25 blur-3xl lg:block" />
                <div className="pointer-events-none absolute bottom-8 right-8 hidden h-28 w-28 overflow-hidden rounded-full border border-primary/25 bg-primary/10 backdrop-blur-sm lg:block">
                  <DotLottieReact
                    src="https://lottie.host/b1cb87a1-21ba-4d7c-bc49-0ff8943aa9d7/wugHSTaHd6.lottie"
                    loop
                    autoplay
                  />
                </div>

                <div className="relative w-full space-y-4">
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                    viewport={{ once: true, amount: 0.5 }}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
                  >
                    Spotlight Partner
                  </motion.p>

                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
                    viewport={{ once: true, amount: 0.5 }}
                    className="text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl"
                  >
                    {featuredCharity?.name ?? "Spotlight Charity"}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
                    viewport={{ once: true, amount: 0.5 }}
                    className="max-w-xl leading-relaxed text-muted-foreground sm:text-lg"
                  >
                    {featuredExcerpt}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.45 }}
                    viewport={{ once: true, amount: 0.5 }}
                  >
                    {featuredCharity ? (
                      <Link
                        href={`/charities/${featuredCharity.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-primary to-accent px-7 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-[1.02] hover:brightness-110"
                      >
                        View Charity Profile
                      </Link>
                    ) : (
                      <p className="inline-flex rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                        Featured charity will be announced shortly.
                      </p>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-6 py-16 md:px-10 lg:py-20">
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
                className="rounded-2xl border border-border/70 bg-card/80 p-6"
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

      <footer className="mx-auto mb-8 w-full max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm sm:p-6 lg:p-8">
          <div
            className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-primary/25 bg-background/60 px-3 py-1.5">
                <Image
                  src="/logoV1.png"
                  alt="Golf Impact logo"
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
                  Golf Impact Platform
                </span>
              </div>

              <h3 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                Better rounds. Bigger impact.
              </h3>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Join a performance-driven community where your game progress and
                subscription contributions help fund verified causes every
                month.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Target className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Track</p>
                  <p className="text-sm font-semibold text-foreground">
                    Progress-led scoring
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-chart-3/20 text-chart-3">
                    <HeartHandshake className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Support</p>
                  <p className="text-sm font-semibold text-foreground">
                    Verified charities
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Secure</p>
                  <p className="text-sm font-semibold text-foreground">
                    Protected workflow
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 sm:p-5">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Quick Access
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href="/charities"
                  className="inline-flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  Explore Charities
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="inline-flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  Plans & Billing
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="inline-flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  Create Account
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  className="inline-flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  Back To Top
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-primary">
                  Next Draw Window
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Keep entering rounds this month to stay eligible for upcoming
                  prize draws.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 flex flex-col gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Copyright {currentYear} Golf Impact. All rights reserved.</p>
            <p className="text-left sm:text-right">
              Built for measurable performance and measurable contribution.
            </p>
          </div>
        </div>
      </footer>

      {isAuthModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-4 backdrop-blur-md"
          onClick={closeAuthModal}
          role="presentation"
        >
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-primary/35 bg-card/95 p-6 shadow-2xl shadow-primary/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-chart-2/15 blur-3xl"
              aria-hidden="true"
            />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Member Access
                </div>
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:border-primary/45 hover:bg-muted"
                aria-label="Close authentication modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-xl border border-border/70 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
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
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-xl border border-input bg-background/80 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    placeholder="you@example.com"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">
                  Password
                </span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-input bg-background/80 py-2 pl-10 pr-20 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {mode === "signup" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm text-muted-foreground">
                      Select Charity Beneficiary
                    </span>
                    <select
                      value={selectedSignupCharityId}
                      onChange={(event) =>
                        setSelectedSignupCharityId(event.target.value)
                      }
                      required
                      className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    >
                      {signupCharities.length === 0 ? (
                        <option value="">No charities available</option>
                      ) : null}
                      {signupCharities.map((charity) => (
                        <option key={charity.id} value={charity.id}>
                          {charity.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm text-muted-foreground">
                      Charity Contribution: {signupCharityPercent}%
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={1}
                      value={signupCharityPercent}
                      onChange={(event) =>
                        setSignupCharityPercent(Number(event.target.value))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Minimum 10%. Increase this any time from your dashboard.
                    </p>
                  </label>
                </>
              ) : null}

              <button
                type="submit"
                disabled={authLoading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? mode === "signin"
                    ? "Signing In..."
                    : "Creating Account..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Protected authentication powered by secure session tokens.
              </p>
            </form>
          </motion.section>
        </div>
      ) : null}
    </main>
  );
}
