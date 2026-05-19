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
