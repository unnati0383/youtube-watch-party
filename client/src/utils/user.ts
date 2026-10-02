/**
 * Helpers for persistent client identity in localStorage
 */

const USER_ID_KEY = "watch_party_user_id";
const USERNAME_KEY = "watch_party_username";

/**
 * Get or generate persistent unique user ID
 */
export function getOrCreateUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

/**
 * Get stored username or empty string
 */
export function getStoredUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || "";
}

/**
 * Store updated username
 */
export function saveUsername(username: string): void {
  if (username && username.trim()) {
    localStorage.setItem(USERNAME_KEY, username.trim());
  }
}
