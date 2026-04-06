"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { createClient as createSupabaseClient } from "../../utils/supabase/client";

type AdminLayoutProps = {
  children: ReactNode;
};

const navItems = [
  {
    label: "Control Center",
    href: "/admin",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_1fr]">
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur-sm md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/90 uppercase">
            Admin Console
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

      <aside className="hidden border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:min-h-screen md:flex-col md:border-b-0 md:border-r">
        <div className="border-b border-sidebar-border px-5 py-4">
          <h1 className="text-base font-semibold">Admin Console</h1>
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            Operational controls and payout workflow
          </p>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin" ? pathname === "/admin" : false;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
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

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
            <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileSidebarOpen ? (
          <motion.div
            key="admin-mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/65 backdrop-blur-sm md:hidden"
            onClick={closeMobileSidebar}
            role="presentation"
          >
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
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
                    item.href === "/admin" ? pathname === "/admin" : false;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobileSidebar}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
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

              <div className="mt-4 border-t border-sidebar-border pt-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="p-3 sm:p-4 md:p-6">{children}</main>
    </div>
  );
}
