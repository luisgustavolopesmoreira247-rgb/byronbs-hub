import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ensureOfficialFan } from "./fans";

/* ------------------------------------------------------------------ */
/* Shared admin auth helper reused by the tools module                */
/* ------------------------------------------------------------------ */

export async function getByronSession(
  ctx: import("./_generated/server").QueryCtx | import("./_generated/server").MutationCtx,
  sid: string,
) {
  const row = await ctx.db
    .query("byronSessionPublic")
    .withIndex("by_sid", (q) => q.eq("sid", sid))
    .unique();
  if (!row) return null;
  return row;
}

async function resolveAdminUser(ctx: import("./_generated/server").QueryCtx, principalId: string) {
  const user = await ctx.db.get(principalId);
  if (!user) return null;
  const u = user as Doc<"users">;
  // The template only stores `role` for auth users, so we treat the creator's
  // auth account as the ByronBS admin touchpoint. We do not store a global
  // password anywhere; instead the owner provides it at runtime through
  // BYRONBS_ADMIN_PASSWORD (documented below).
  if (!u || (u.role !== "admin" && u.role !== "member" && u.role !== "user")) {
    return null;
  }
  return u;
}

async function verifyByronPassword(ctx: import("./_generated/server").MutationCtx, password: string) {
  const expected = process.env.BYRONBS_ADMIN_PASSWORD;
  if (!expected) {
    throw new Error(
      "Credencial do ByronBS não configurada. Adicione BYRONBS_ADMIN_PASSWORD na aba Keys/API keys.",
    );
  }
  if (password !== expected) {
    throw new Error("Senha do ByronBS incorreta.");
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Admin session                                                       */
/* ------------------------------------------------------------------ */

type QueryCtx = import("./_generated/server").QueryCtx;
type MutationCtx = import("./_generated/server").MutationCtx;

/* ------------------------------------------------------------------ */
/* Admin tools: groups, polls, posts, events                          */
/* ------------------------------------------------------------------ */

import { requireByronSession } from "./byron";
import { requireFan } from "./fans";

async function createByronSession(ctx: import("./_generated/server").MutationCtx) {
  const sid = crypto.randomUUID();
  const principalId = await import("./_generated/server").getAuthUserId(ctx);
  if (!principalId) throw new Error("Usuário não autenticado.");
  await ctx.db.insert("byronSessionPublic", {
    sid,
    userPrincipalId: principalId,
    createdAt: Date.now(),
  });
  return sid;
}

export async function requireByronSession(
  ctx: import("./_generated/server").QueryCtx | import("./_generated/server").MutationCtx,
  args: { sid: string },
): Promise<{ sid: string; userPrincipalId: string }> {
  const row = await ctx.db
    .query("byronSessionPublic")
    .withIndex("by_sid", (q) => q.eq("sid", args.sid))
    .unique();
  if (!row) throw new Error("Sessão do ByronBS expirou. Faça login novamente.");
  return { sid: row.sid, userPrincipalId: row.userPrincipalId };
}

/* ------------------------------------------------------------------ */
/* Admin mutations                                                     */
/* ------------------------------------------------------------------ */

export const byronLogin = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    await verifyByronPassword(ctx, args.password);
    await ensureOfficialFan(ctx);
    const sid = await createByronSession(ctx);
    return { ok: true, sid };
  },
});

export const byronLogout = mutation({
  args: { sid: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("byronSessionPublic")
      .withIndex("by_sid", (q) => q.eq("sid", args.sid))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries: fans, groups, polls, posts, events accessors         */
/* ------------------------------------------------------------------ */

export const adminFanBrief = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("fans").collect();
    const out = [];
    for (const f of all) {
      out.push({
        fanId: f._id,
        name: f.name,
        fanNumber: f.fanNumber,
        isOfficial: f.isOfficial ?? false,
        createdAt: f.createdAt,
      });
    }
    out.sort((a, b) => a.fanNumber - b.fanNumber);
    return out;
  },
});

export const adminContactsForFan = query({
  args: { fanId: v.id("fans"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await ctx.db.get(args.fanId);
    if (!me) return [];
    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.fanId))
      .collect();
    const out = [];
    for (const row of rows) {
      const other = await ctx.db.get(row.contactId);
      if (!other) continue;
      const cid = [args.fanId, other._id].sort().join("_");
      const last = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", cid))
        .order("desc")
        .first();
      const unreadAll = await ctx.db
        .query("messages")
        .withIndex("by_to_unread", (q) => q.eq("toId", args.fanId).eq("readAt", 0))
        .collect();
      const unreadByConv = new Map<string, number>();
      for (const m of unreadAll) unreadByConv.set(m.conversationId, (unreadByConv.get(m.conversationId) ?? 0) + 1);
      out.push({
        fanId: other._id,
        name: other.name,
        fanNumber: other.fanNumber,
        isOfficial: other.isOfficial ?? false,
        lastMessage: last
          ? { kind: last.kind, body: last.kind === "text" ? (last.body ?? "") : "", fromMe: last.fromId === args.fanId, createdAt: last.createdAt }
          : null,
        unread: unreadByConv.get(cid) ?? 0,
        createdAt: row.createdAt,
      });
    }
    out.sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
    return out;
  },
});
