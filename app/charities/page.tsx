"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
};

const baseCategories = ["All", "Education", "Environment", "Health"];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

function normalizeCategory(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
}

function truncate(value: string | null, maxLength: number): string {
  if (!value) {
    return "This organization is building measurable outcomes for communities in need.";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

export default function CharityDirectoryPage() {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCharities = async () => {
      let supabase;
      try {
        supabase = createSupabaseClient();
      } catch {
        setErrorMessage("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const withCategory = await supabase
        .from("charities")
        .select("id, name, description, image_url, category")
        .order("name", { ascending: true });

      if (!withCategory.error) {
        setCharities((withCategory.data ?? []) as Charity[]);
        setIsLoading(false);
        return;
      }

      const withoutCategory = await supabase
        .from("charities")
        .select("id, name, description, image_url")
        .order("name", { ascending: true });

      if (withoutCategory.error) {
        setErrorMessage(
          `Failed to load charities: ${withoutCategory.error.message}`,
        );
        setIsLoading(false);
        return;
      }

      const fallbackData = (withoutCategory.data ?? []).map(
        (item: Omit<Charity, "category">) => ({ ...item, category: null }),
      );
      setCharities(fallbackData);
      setIsLoading(false);
    };

    void loadCharities();
  }, []);

  const categories = useMemo(() => {
    const discovered = Array.from(
      new Set(charities.map((item) => normalizeCategory(item.category))),
    );

    return [
      ...baseCategories,
      ...discovered.filter((item) => !baseCategories.includes(item)),
    ];
  }, [charities]);

  const filteredCharities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return charities.filter((charity) => {
      const category = normalizeCategory(charity.category);
      const categoryMatch =
        activeCategory === "All" || category === activeCategory;
      const searchMatch =
        normalizedSearch.length === 0 ||
        charity.name.toLowerCase().includes(normalizedSearch);

      return categoryMatch && searchMatch;
    });
  }, [activeCategory, charities, searchTerm]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="rounded-2xl border border-primary/30 bg-linear-to-br from-primary/10 via-accent/10 to-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
            Public Charity Directory
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Discover Verified Causes Worth Backing
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Explore impact-driven organizations, filter by category, and review
            profiles before choosing who to support.
          </p>
        </header>

        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-md">
              <label htmlFor="charity-search" className="sr-only">
                Search charities by name
              </label>
              <input
                id="charity-search"
                type="text"
                placeholder="Search by charity name..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = category === activeCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
            Loading charities...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          filteredCharities.length > 0 ? (
            <motion.section
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {filteredCharities.map((charity) => (
                <motion.article
                  key={charity.id}
                  variants={cardVariants}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="relative h-48 overflow-hidden bg-muted">
                    {charity.image_url ? (
                      <Image
                        src={charity.image_url}
                        alt={charity.name}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Impact image coming soon
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-5">
                    <p className="inline-flex rounded-full bg-accent/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
                      {normalizeCategory(charity.category)}
                    </p>

                    <h2 className="text-lg font-semibold leading-tight">
                      {charity.name}
                    </h2>

                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {truncate(charity.description, 145)}
                    </p>

                    <Link
                      href={`/charities/${charity.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-linear-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                    >
                      View Impact Profile
                    </Link>
                  </div>
                </motion.article>
              ))}
            </motion.section>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
              No charities match your search and filter selection.
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}
