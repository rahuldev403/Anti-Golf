"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

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

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_1fr]">
      <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:min-h-screen md:border-b-0 md:border-r">
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <ThemeToggle className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </aside>

      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
