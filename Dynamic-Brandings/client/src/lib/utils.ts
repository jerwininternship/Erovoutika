import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the current time in Philippine timezone (Asia/Manila) as an ISO string.
 * This is used for storing timestamps in the database to ensure correct local time.
 * The database uses timestamp without timezone, so we need to store the local time directly.
 */
export function getPhilippineTimeISO(): string {
  const now = new Date();
  // Format in Philippine timezone and create a proper ISO-like string
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // sv-SE locale gives us YYYY-MM-DD HH:mm:ss format
  const formatted = formatter.format(now);
  // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss"
  return formatted.replace(' ', 'T');
}
