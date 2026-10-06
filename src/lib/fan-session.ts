import type { Id } from "@/convex/_generated/dataModel";

/**
 * Fan session — the lightweight identity of the Comunidade ByronBS.
 *
 * Only the fan number and display name are personal-ish data, and the number
 * itself encodes nothing: it is a sequential community ID (#10, #20, …),
 * never a phone number or any real-world identifier.
 */

export type FanSession = {
  fanId: Id<"fans">;
  secret: string;
  name: string;
  fanNumber: number;
};

const STORAGE_KEY = "byronbs.fan.session.v1";

export function getFanSession(): FanSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FanSession;
    if (!parsed?.fanId || !parsed?.secret || !parsed?.fanNumber) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setFanSession(session: FanSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearFanSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
