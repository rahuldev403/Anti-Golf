"use client";

import { Eye, Search } from "lucide-react";
import { useMemo, useState } from "react";

type UserItem = {
  id: string;
  role: string | null;
  subscription_status: "active" | "inactive" | string;
  selected_charity_name?: string | null;
  selected_charity_id?: string | null;
  charity_percentage?: number | null;
};

type UserManagementTableProps = {
  users: UserItem[];
  onViewScores?: (userId: string) => void;
  loadingScoresForUser?: string | null;
};

function formatCharityContribution(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${value}%`;
}

export default function UserManagementTable({
  users,
  onViewScores,
  loadingScoresForUser = null,
}: UserManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const idMatch = user.id.toLowerCase().includes(query);
      const charityName = (user.selected_charity_name ?? "").toLowerCase();
      const charityMatch = charityName.includes(query);

      return idMatch || charityMatch;
    });
  }, [searchQuery, users]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">User Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search users by ID or selected charity.
          </p>
        </div>

        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Search users</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by user or charity"
            className="w-full rounded-lg border border-border/50 bg-background py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border/50">
        <table className="min-w-225 text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Subscription Status</th>
              <th className="px-4 py-3 font-medium">Selected Charity</th>
              <th className="px-4 py-3 font-medium">Charity Contribution %</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isActive = user.subscription_status === "active";

                return (
                  <tr
                    key={user.id}
                    className="border-t border-border/50 bg-card/70 transition hover:bg-muted/25"
                  >
                    <td className="px-4 py-3 font-mono text-xs sm:text-sm">
                      {user.id}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {user.role ?? "user"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isActive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="capitalize">
                          {isActive ? "active" : "inactive"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.selected_charity_name ?? "Not selected"}
                    </td>
                    <td className="px-4 py-3">
                      {formatCharityContribution(user.charity_percentage)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onViewScores?.(user.id)}
                        disabled={
                          !onViewScores || loadingScoresForUser === user.id
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm font-medium transition hover:border-primary/60 hover:text-primary"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        {loadingScoresForUser === user.id
                          ? "Loading..."
                          : "View Scores"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No users matched your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
