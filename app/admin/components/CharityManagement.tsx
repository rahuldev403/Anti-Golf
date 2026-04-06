"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_featured: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  is_featured: boolean;
  image_url: string;
};

type CharityManagementProps = {
  initialCharities: Charity[];
};

type UploadImageResult = {
  publicUrl: string | null;
  error: string | null;
};

type ImageInputMode = "upload" | "url";

const INITIAL_FORM_STATE: FormState = {
  name: "",
  description: "",
  category: "",
  is_featured: false,
  image_url: "",
};

async function uploadImageToStorage(file: File): Promise<UploadImageResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/charities/upload", {
      method: "POST",
      body: formData,
    });

    const result = (await response.json()) as {
      success: boolean;
      data?: { publicUrl?: string };
      error?: string;
    };

    if (!response.ok || !result.success || !result.data?.publicUrl) {
      return {
        publicUrl: null,
        error: result.error || "Failed to upload image.",
      };
    }

    return { publicUrl: result.data.publicUrl, error: null };
  } catch (error) {
    console.error("Image upload error:", error);
    return {
      publicUrl: null,
      error: error instanceof Error ? error.message : "Failed to upload image.",
    };
  }
}

export default function CharityManagement({
  initialCharities,
}: CharityManagementProps) {
  const [charities, setCharities] = useState<Charity[]>(initialCharities);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharityId, setEditingCharityId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageInputMode, setImageInputMode] =
    useState<ImageInputMode>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const filteredCharities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return charities;
    return charities.filter(
      (charity) =>
        charity.name.toLowerCase().includes(query) ||
        (charity.category?.toLowerCase().includes(query) ?? false),
    );
  }, [charities, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCharities.length / pageSize),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedCharities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCharities.slice(start, start + pageSize);
  }, [currentPage, filteredCharities]);

  const startItem =
    filteredCharities.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredCharities.length);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageInputMode("upload");
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (value: string) => {
    const nextValue = value.trimStart();
    setImageInputMode("url");
    setImageFile(null);
    setFormState((prev) => ({ ...prev, image_url: nextValue }));
    setImagePreview(nextValue);
  };

  const clearImageSelection = () => {
    setImageFile(null);
    if (imageInputMode === "url") {
      setFormState((prev) => ({ ...prev, image_url: "" }));
    }
    setImagePreview("");
  };

  const openNewCharityModal = () => {
    setEditingCharityId(null);
    setFormState(INITIAL_FORM_STATE);
    setImageInputMode("upload");
    clearImageSelection();
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (charity: Charity) => {
    setEditingCharityId(charity.id);
    setFormState({
      name: charity.name,
      description: charity.description || "",
      category: charity.category || "",
      is_featured: charity.is_featured,
      image_url: charity.image_url || "",
    });
    setImageFile(null);
    setImageInputMode(charity.image_url ? "url" : "upload");
    setImagePreview(charity.image_url || "");
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCharityId(null);
    setFormState(INITIAL_FORM_STATE);
    setImageInputMode("upload");
    clearImageSelection();
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!formState.name.trim()) {
        setError("Charity name is required.");
        setIsLoading(false);
        return;
      }

      let imageUrl = formState.image_url;

      if (imageInputMode === "url") {
        const trimmedUrl = formState.image_url.trim();
        if (trimmedUrl) {
          try {
            new URL(trimmedUrl);
          } catch {
            setError("Please enter a valid image URL.");
            setIsLoading(false);
            return;
          }
        }
        imageUrl = trimmedUrl;
      }

      if (imageInputMode === "upload" && imageFile) {
        const uploadResult = await uploadImageToStorage(imageFile);
        if (!uploadResult.publicUrl) {
          setError(uploadResult.error || "Failed to upload image.");
          setIsLoading(false);
          return;
        }
        imageUrl = uploadResult.publicUrl;
      }

      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        category: formState.category.trim() || null,
        is_featured: formState.is_featured,
        image_url: imageUrl || null,
        ...(editingCharityId && { id: editingCharityId }),
      };

      const endpoint = "/api/admin/charities";
      const method = editingCharityId === null ? "POST" : "PUT";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success: boolean;
        data?: Charity;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.error || "Failed to save charity.");
        setIsLoading(false);
        return;
      }

      if (editingCharityId === null) {
        if (result.data) {
          setCharities((prev) => [...prev, result.data as Charity]);
          setSuccessMessage("Charity created successfully!");
        }
      } else {
        if (result.data) {
          setCharities((prev) =>
            prev.map((charity) =>
              charity.id === editingCharityId
                ? (result.data as Charity)
                : charity,
            ),
          );
          setSuccessMessage("Charity updated successfully!");
        }
      }

      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (charityId: string, charityName: string) => {
    if (
      !window.confirm(`Delete charity "${charityName}"? This cannot be undone.`)
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/charities", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: charityId }),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.error || "Failed to delete charity.");
        setIsLoading(false);
        return;
      }

      setCharities((prev) =>
        prev.filter((charity) => charity.id !== charityId),
      );
      setSuccessMessage("Charity deleted successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pointer-events-none fixed right-4 top-4 z-90 flex w-[min(92vw,24rem)] flex-col gap-2">
        <AnimatePresence>
          {error ? (
            <motion.div
              key={`charity-error-${error}`}
              initial={{ opacity: 0, x: 16, y: -8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 16, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto rounded-xl border border-destructive/40 bg-destructive/95 p-3 text-sm text-destructive-foreground shadow-lg"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="mt-0.5 rounded p-1 text-destructive-foreground/80 transition hover:bg-black/10 hover:text-destructive-foreground"
                  aria-label="Close error notification"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : null}

          {successMessage ? (
            <motion.div
              key={`charity-success-${successMessage}`}
              initial={{ opacity: 0, x: 16, y: -8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 16, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto rounded-xl border border-emerald-300/70 bg-emerald-600 p-3 text-sm text-white shadow-lg"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{successMessage}</p>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="mt-0.5 rounded p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close success notification"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Charity Management
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Create, edit, and organize charities from one place.
            </p>
          </div>
          <button
            onClick={openNewCharityModal}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 sm:w-auto"
          >
            <Plus size={18} />
            Add New Charity
          </button>
        </div>

        <div className="mt-3">
          <input
            type="text"
            placeholder="Search by name or category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredCharities.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No charities found
          </div>
        ) : (
          paginatedCharities.map((charity) => (
            <div
              key={charity.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {charity.image_url ? (
                    <img
                      src={charity.image_url}
                      alt={charity.name}
                      className="h-11 w-11 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      NA
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {charity.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {charity.category || "Uncategorized"}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    charity.is_featured
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {charity.is_featured ? "Featured" : "Standard"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => openEditModal(charity)}
                  disabled={isLoading}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  <Edit2 size={15} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(charity.id, charity.name)}
                  disabled={isLoading}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="px-6 py-4 font-semibold text-foreground">Name</th>
              <th className="px-6 py-4 font-semibold text-foreground">
                Category
              </th>
              <th className="px-6 py-4 font-semibold text-foreground">
                Featured
              </th>
              <th className="px-6 py-4 font-semibold text-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCharities.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  No charities found
                </td>
              </tr>
            ) : (
              paginatedCharities.map((charity) => (
                <tr
                  key={charity.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {charity.image_url && (
                        <img
                          src={charity.image_url}
                          alt={charity.name}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      )}
                      <span className="font-medium text-foreground">
                        {charity.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {charity.category || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        charity.is_featured
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {charity.is_featured ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditModal(charity)}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded px-3 py-2 text-sm text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(charity.id, charity.name)}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredCharities.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem}-{endItem} of {filteredCharities.length}{" "}
            charities
          </p>

          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]">
          <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
              <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Charity Admin
                    </p>
                    <h2 className="text-lg font-bold text-foreground sm:text-xl">
                      {editingCharityId === null
                        ? "Add New Charity"
                        : "Edit Charity"}
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {editingCharityId === null ? "Create" : "Update"}
                  </span>
                </div>
              </div>

              <button
                onClick={closeModal}
                disabled={isLoading}
                aria-label="Close charity form"
                title="Close charity form"
                className="absolute right-5 top-5 rounded-md p-1 transition hover:bg-muted disabled:opacity-50"
              >
                <X size={20} className="text-foreground" />
              </button>

              <form
                onSubmit={handleSubmit}
                className="max-h-[80vh] space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="charity-name"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Name *
                    </label>
                    <input
                      id="charity-name"
                      type="text"
                      value={formState.name}
                      onChange={(e) =>
                        setFormState({ ...formState, name: e.target.value })
                      }
                      placeholder="Charity name"
                      required
                      disabled={isLoading}
                      className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="charity-category"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Category
                    </label>
                    <input
                      id="charity-category"
                      type="text"
                      value={formState.category}
                      onChange={(e) =>
                        setFormState({ ...formState, category: e.target.value })
                      }
                      placeholder="Education, Health, Environment"
                      disabled={isLoading}
                      className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="flex items-end rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                    <label
                      htmlFor="is_featured"
                      className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground"
                    >
                      <input
                        type="checkbox"
                        id="is_featured"
                        checked={formState.is_featured}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            is_featured: e.target.checked,
                          })
                        }
                        disabled={isLoading}
                        className="h-4 w-4 cursor-pointer rounded border-input accent-primary disabled:opacity-50"
                      />
                      Mark as Featured
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="charity-description"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Description
                    </label>
                    <textarea
                      id="charity-description"
                      value={formState.description}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          description: e.target.value,
                        })
                      }
                      placeholder="Briefly describe this charity"
                      disabled={isLoading}
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="charity-image-mode-upload"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Logo/Image
                    </label>
                    <div className="mt-1.5 space-y-3">
                      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                        <button
                          id="charity-image-mode-upload"
                          type="button"
                          onClick={() => setImageInputMode("upload")}
                          disabled={isLoading}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                            imageInputMode === "upload"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Local File
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageInputMode("url")}
                          disabled={isLoading}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                            imageInputMode === "url"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Paste URL
                        </button>
                      </div>

                      {imageInputMode === "upload" ? (
                        <input
                          id="charity-image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={isLoading}
                          aria-label="Upload charity image file"
                          title="Upload charity image file"
                          className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:brightness-110 disabled:opacity-50 sm:text-sm sm:file:text-sm"
                        />
                      ) : (
                        <input
                          id="charity-image-url"
                          type="url"
                          value={formState.image_url ?? ""}
                          onChange={(e) => handleImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          disabled={isLoading}
                          aria-label="Paste charity image URL"
                          title="Paste charity image URL"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                        />
                      )}

                      {imagePreview && (
                        <div className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-14 w-14 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={clearImageSelection}
                            disabled={isLoading}
                            aria-label="Clear selected image"
                            title="Clear selected image"
                            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isLoading}
                    className="h-10 flex-1 rounded-lg border border-input bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                  >
                    {isLoading
                      ? "Saving..."
                      : editingCharityId === null
                        ? "Create Charity"
                        : "Update Charity"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
