import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getValidUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

export const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
];

export const getAvatarColor = (name: string): string => {
  if (!name) return AVATAR_COLORS[0];
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

/**
 * Sanitize a filename for use as a Supabase Storage object key.
 * Supabase Storage rejects Umlauts, accents and many special chars with
 * "Invalid key". This maps German Umlauts (ä->ae etc.), strips remaining
 * Unicode diacritics, lowercases, collapses runs of invalid chars to "_",
 * and preserves the file extension. Returns "file" as fallback if the
 * input collapses to empty.
 */
export const sanitizeStorageKey = (filename: string): string => {
  if (!filename) return "file";
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";

  const slug = (s: string) =>
    s
      .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
      .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
      .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
      .replace(/ß/g, "ss")
      .normalize("NFD").replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "");

  const cleanStem = slug(stem) || "file";
  const cleanExt = slug(ext);
  return cleanExt ? `${cleanStem}.${cleanExt}` : cleanStem;
};
