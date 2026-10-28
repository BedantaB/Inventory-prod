/**
 * Staff log in with a username. Supabase Auth needs an email, so each username maps to an
 * internal address: ramesh → ramesh@<STAFF_EMAIL_DOMAIN>. The admin logs in with a real email.
 * The login box accepts either: anything containing "@" is treated as an email.
 */

/** 3–30 chars: lowercase letters, digits, dot, dash, underscore; starts with a letter or digit. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function staffEmail(username: string, domain: string): string {
  return `${normaliseUsername(username)}@${domain}`;
}

/** What the person typed in the login box → the email Supabase Auth expects. */
export function loginEmail(identifier: string, domain: string): string {
  const value = identifier.trim();
  return value.includes("@") ? value.toLowerCase() : staffEmail(value, domain);
}
