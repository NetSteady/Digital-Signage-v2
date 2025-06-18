/**
 * Utility functions for date handling in digital signage
 */

/**
 * Format milliseconds into a human-readable duration
 */
export function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format a date string into a readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Check if a playlist is currently active based on start and end dates
 */
export function isPlaylistActive(
  startDate?: string | null,
  endDate?: string | null
): boolean {
  const now = new Date();

  if (startDate && new Date(startDate) > now) {
    return false;
  }

  if (endDate && new Date(endDate) <= now) {
    return false;
  }

  return true;
}

/**
 * Get time until playlist starts
 */
export function getTimeUntilStart(startDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  return Math.max(0, start.getTime() - now.getTime());
}

/**
 * Get time until playlist ends
 */
export function getTimeUntilEnd(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  return Math.max(0, end.getTime() - now.getTime());
}

/**
 * Get a user-friendly message about playlist timing
 */
export function getPlaylistTimingMessage(
  playlistName: string,
  startDate?: string | null,
  endDate?: string | null
): string {
  const now = new Date();

  if (startDate && new Date(startDate) > now) {
    const timeUntilStart = getTimeUntilStart(startDate);
    const formattedTime = formatDuration(timeUntilStart);
    return `Playlist "${playlistName}" starts in ${formattedTime}`;
  }

  if (endDate && new Date(endDate) <= now) {
    return `Playlist "${playlistName}" has ended`;
  }

  if (endDate) {
    const timeUntilEnd = getTimeUntilEnd(endDate);
    const formattedTime = formatDuration(timeUntilEnd);
    return `Playlist "${playlistName}" ends in ${formattedTime}`;
  }

  return `Playlist "${playlistName}" is active`;
}

/**
 * Sort playlists by their start date (earliest first)
 */
export function sortPlaylistsByStartDate<
  T extends { startDate?: string | null }
>(playlists: T[]): T[] {
  return playlists.sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
}

/**
 * Get the next scheduled playlist
 */
export function getNextScheduledPlaylist<
  T extends { startDate?: string | null; playlistName: string }
>(playlists: T[]): T | null {
  const now = new Date();
  const futurePlaylists = playlists.filter(
    (playlist) => playlist.startDate && new Date(playlist.startDate) > now
  );

  if (futurePlaylists.length === 0) return null;

  return sortPlaylistsByStartDate(futurePlaylists)[0];
}
