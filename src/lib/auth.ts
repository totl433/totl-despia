// src/lib/auth.ts
export type User = { id: string; displayName: string; email?: string };

const KEY = 'totl_user';

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as User : null;
  } catch { return null; }
}

export function signIn(displayName: string, email?: string): User {
  // NOTE: real uniqueness comes from the backend; this is a placeholder.
  const clean = displayName.trim();
  if (!clean) throw new Error('Display name is required.');
  if (clean.length < 3) throw new Error('Name must be at least 3 characters.');
  if (clean.length > 18) throw new Error('Name must be at most 18 characters.');

  const id = `u_${crypto.randomUUID()}`;
  const user: User = { id, displayName: clean, email: email?.trim() || undefined };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export function signOut() {
  localStorage.removeItem(KEY);
}