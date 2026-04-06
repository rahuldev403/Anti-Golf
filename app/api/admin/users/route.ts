import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type UpdateUserBody = {
  user_id?: unknown;
  role?: unknown;
  selected_charity_id?: unknown;
  charity_percentage?: unknown;
  subscription_status?: unknown;
};

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(
        "Supabase environment variables are not configured.",
        500,
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    let body: UpdateUserBody = {};
    try {
      body = (await request.json()) as UpdateUserBody;
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const userId =
      typeof body.user_id === "string" && body.user_id.trim().length > 0
        ? body.user_id.trim()
        : null;

    if (!userId) {
      return jsonError("user_id is required.", 400);
    }

    const serviceDb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const updateUserData: Record<string, unknown> = {};

    if (typeof body.role === "string" && body.role.trim().length > 0) {
      updateUserData.role = body.role.trim();
    }

    if (typeof body.selected_charity_id === "string") {
      const trimmed = body.selected_charity_id.trim();
      updateUserData.selected_charity_id = trimmed.length > 0 ? trimmed : null;
    }

    if (typeof body.charity_percentage === "number") {
      const safe = Math.min(
        50,
        Math.max(10, Math.round(body.charity_percentage)),
      );
      updateUserData.charity_percentage = safe;
    }

    if (Object.keys(updateUserData).length > 0) {
      const { error: userUpdateError } = await serviceDb
        .from("users")
        .update(updateUserData)
        .eq("id", userId);

      if (userUpdateError) {
        return jsonError(
          "Failed to update user profile.",
          500,
          userUpdateError.message,
        );
      }
    }

    if (typeof body.subscription_status === "string") {
      const targetStatus = body.subscription_status.trim().toLowerCase();

      if (targetStatus === "inactive") {
        const { error: deactivateError } = await serviceDb
          .from("subscriptions")
          .update({ status: "inactive" })
          .eq("user_id", userId)
          .eq("status", "active");

        if (deactivateError) {
          return jsonError(
            "Failed to deactivate subscription.",
            500,
            deactivateError.message,
          );
        }
      }

      if (targetStatus === "active") {
        const { data: latest, error: latestError } = await serviceDb
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestError) {
          return jsonError(
            "Failed to inspect subscriptions.",
            500,
            latestError.message,
          );
        }

        if (latest?.id) {
          const { error: activateError } = await serviceDb
            .from("subscriptions")
            .update({ status: "active" })
            .eq("id", latest.id);

          if (activateError) {
            return jsonError(
              "Failed to activate subscription.",
              500,
              activateError.message,
            );
          }
        } else {
          const { error: createError } = await serviceDb
            .from("subscriptions")
            .insert({
              user_id: userId,
              status: "active",
              plan_type: "monthly",
            });

          if (createError) {
            return jsonError(
              "Failed to create subscription.",
              500,
              createError.message,
            );
          }
        }
      }
    }

    const { data: updatedUser, error: userFetchError } = await serviceDb
      .from("users")
      .select("id, role, selected_charity_id, charity_percentage")
      .eq("id", userId)
      .single();

    if (userFetchError) {
      return jsonError(
        "Updated but failed to fetch user profile.",
        500,
        userFetchError.message,
      );
    }

    const { data: subscriptions, error: subsFetchError } = await serviceDb
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId);

    if (subsFetchError) {
      return jsonError(
        "Updated but failed to fetch subscription status.",
        500,
        subsFetchError.message,
      );
    }

    const hasActive = (subscriptions ?? []).some(
      (row) => row.status === "active",
    );

    return NextResponse.json(
      {
        success: true,
        message: "User settings updated successfully.",
        user: {
          ...updatedUser,
          subscription_status: hasActive ? "active" : "inactive",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    return jsonError("Unexpected error while updating user.", 500, message);
  }
}
