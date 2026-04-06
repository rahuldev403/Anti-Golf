"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, Heart, Home, LogOut, Menu, Target, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";

type DashboardLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: "Enter Scores",
    href: "/dashboard/scores",
    icon: <Target className="h-4 w-4" />,
  },
  {
    label: "Charity Impact",
    href: "/dashboard/charity",
    icon: <Heart className="h-4 w-4" />,
  },
  {
    label: "Billing & Plan",
    href: "/dashboard/billing",
    icon: <CreditCard className="h-4 w-4" />,
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const supabase = createSupabaseClient();

  const activePath = pathname ?? "/dashboard";

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out.";
      console.error(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[280px_1fr]">
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur-sm md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/90 uppercase">
            Fintech Dashboard
          </p>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Open sidebar navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="border-b border-sidebar-border px-6 py-6">
          <h1 className="text-lg font-semibold">Portfolio View</h1>
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            Insights, impact, and premium controls.
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? activePath === "/dashboard"
                : activePath.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-sidebar-accent text-black dark:text-black font-bold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileSidebarOpen ? (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/65 backdrop-blur-sm md:hidden"
            onClick={closeMobileSidebar}
            role="presentation"
          >
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between border-b border-sidebar-border pb-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  Navigation
                </h2>
                <button
                  type="button"
                  onClick={closeMobileSidebar}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="Close sidebar navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? activePath === "/dashboard"
                      : activePath.startsWith(item.href);

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobileSidebar}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        isActive
                          ? "bg-sidebar-accent text-black dark:text-black font-bold"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-sidebar-border pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="bg-background">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
