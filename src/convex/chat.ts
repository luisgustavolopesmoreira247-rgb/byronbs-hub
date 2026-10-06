import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireFan } from "./fans";

const fanArgs = { fanId: v.id("fans"), secret: v.string() } as const;

/** Canonical conversation id: both fan ids sorted, so a_b === b_a. */
function conversationId(a: Id<"fans">, b: Id<"fans">): string {
  return [a, b].sort().join("_");
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

/**
 * Contact list with last-message preview and unread count for each one,
 * sorted by most recent activity. The official ByronBS contact is created
 * automatically at join, so it is always present for every member.
 */
export const listContacts = query({
  args: fanArgs,
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();

    const unreadAll = await ctx.db
      .query("messages")
      .withIndex("by_to_unread", (q) => q.eq("toId", me._id).eq("readAt", 0))
      .collect();
    const unreadByConv = new Map<string, number>();
    for (const m of unreadAll) {
      unreadByConv.set(m.conversationId, (unreadByConv.get(m.conversationId) ?? 0) + 1);
    }

    const contacts = [];
    for (const row of rows) {
      const other = await ctx.db.get(row.contactId);
      if (!other) continue;

      const cid = conversationId(me._id, other._id);
      const last = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", cid))
        .order("desc")
        .first();

      contacts.push({
        fanId: other._id,
        name: other.name,
        fanNumber: other.fanNumber,
        isOfficial: other.isOfficial ?? false,
        lastMessage: last
          ? {
              kind: last.kind,
              body: last.kind === "text" ? (last.body ?? "") : "",
              fromMe: last.fromId === me._id,
              createdAt: last.createdAt,
            }
          : null,
        unread: unreadByConv.get(cid) ?? 0,
      });
    }

    contacts.sort(
      (a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0),
    );
    return { myFanNumber: me.fanNumber, myName: me.name, contacts };
  },
});

/**
 * Adds a member to your contact list by their public fan number.
 * Fails on unknown numbers, yourself and duplicates; never leaks personal data.
 */
export const addContact = mutation({
  args: { ...fanArgs, number: v.number() },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    if (!Number.isInteger(args.number) || args.number <= 0) {
      throw new Error("Digite um número de fã válido.");
    }
    const found = await ctx.db
      .query("fans")
      .withIndex("by_number", (q) => q.eq("fanNumber", args.number))
      .unique();
    if (!found) {
      throw new Error(`Nenhum membro com o número #${args.number} foi encontrado.`);
    }
    if (found._id === me._id) {
      throw new Error("Este é o seu próprio número de fã.");
    }
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("contactId", found._id))
      .unique();
    if (existing) {
      throw new Error(`${found.name} (#${found.fanNumber}) já está nos seus contatos.`);
    }
    await ctx.db.insert("contacts", {
      ownerId: me._id,
      contactId: found._id,
      createdAt: Date.now(),
    });
    return { fanId: found._id, name: found.name, fanNumber: found.fanNumber };
  },
});

/** Removes a contact (conversations history is kept server-side). */
export const removeContact = mutation({
  args: { ...fanArgs, contactId: v.id("fans") },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const row = await ctx.db
      .query("contacts")
      .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("contactId", args.contactId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

/** Full conversation with one contact, oldest → newest, media URLs resolved. */
export const listMessages = query({
  args: { ...fanArgs, contactId: v.id("fans") },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const cid = conversationId(me._id, args.contactId);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", cid))
      .order("asc")
      .take(300);

    const out = [];
    for (const m of rows) {
      out.push({
        id: m._id,
        fromId: m.fromId,
        mine: m.fromId === me._id,
        kind: m.kind,
        body: m.body ?? "",
        url: m.storageId ? await ctx.storage.getUrl(m.storageId) : null,
        createdAt: m.createdAt,
      });
    }
    return out;
  },
});

/** Sends a text / image / audio message. Enforces blocks and contact rules. */
export const sendMessage = mutation({
  args: {
    ...fanArgs,
    contactId: v.id("fans"),
    kind: v.union(v.literal("text"), v.literal("image"), v.literal("audio")),
    body: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const other = await ctx.db.get(args.contactId);
    if (!other) throw new Error("Membro não encontrado.");
    if (other._id === me._id) throw new Error("Você não pode enviar mensagens para si mesmo.");

    const blocked = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("ownerId", other._id).eq("blockedId", me._id))
      .unique();
    if (blocked) throw new Error("Você não pode enviar mensagens para este membro.");

    const iBlocked = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("blockedId", other._id))
      .unique();
    if (iBlocked) throw new Error("Desbloqueie este membro para enviar mensagens.");

    if (!other.isOfficial) {
      const connected =
        (await ctx.db
          .query("contacts")
          .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("contactId", other._id))
          .unique()) ??
        (await ctx.db
          .query("contacts")
          .withIndex("by_pair", (q) => q.eq("ownerId", other._id).eq("contactId", me._id))
          .unique());
      if (!connected) {
        throw new Error("Adicione este membro aos seus contatos primeiro.");
      }
    }

    if (args.kind === "text") {
      const text = (args.body ?? "").trim();
      if (!text) throw new Error("A mensagem não pode estar vazia.");
      if (text.length > 1000) throw new Error("Mensagem muito longa (máx. 1000 caracteres).");
    } else if (!args.storageId) {
      throw new Error("Arquivo da mensagem ausente.");
    }

    // Anti-spam: at most 8 messages per 10 seconds from one account.
    const windowStart = Date.now() - 10_000;
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_from_created", (q) => q.eq("fromId", me._id).gte("createdAt", windowStart))
      .collect();
    if (recent.length >= 8) {
      throw new Error("Você está enviando mensagens rápido demais. Aguarde alguns segundos.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      fromId: me._id,
      toId: other._id,
      conversationId: conversationId(me._id, other._id),
      kind: args.kind,
      body: args.kind === "text" ? (args.body ?? "").trim() : undefined,
      storageId: args.kind === "text" ? undefined : args.storageId,
      readAt: 0,
      createdAt: now,
    });

    // Mirror the contact so the receiver sees the conversation, the name and
    // the unread badge on their side too (official contact is already added).
    if (!other.isOfficial) {
      const reverse = await ctx.db
        .query("contacts")
        .withIndex("by_pair", (q) => q.eq("ownerId", other._id).eq("contactId", me._id))
        .unique();
      if (!reverse) {
        await ctx.db.insert("contacts", {
          ownerId: other._id,
          contactId: me._id,
          createdAt: now,
        });
      }
    }

    return { id };
  },
});

/** Marks every message coming from `contactId` as read. */
export const markRead = mutation({
  args: { ...fanArgs, contactId: v.id("fans") },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const cid = conversationId(me._id, args.contactId);
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_to_unread", (q) => q.eq("toId", me._id).eq("readAt", 0))
      .collect();
    const now = Date.now();
    for (const m of unread) {
      if (m.conversationId === cid) await ctx.db.patch(m._id, { readAt: now });
    }
    return { ok: true };
  },
});

/** Upload URL for photos and audio notes (Convex storage). */
export const generateUploadUrl = mutation({
  args: fanArgs,
  handler: async (ctx, args) => {
    await requireFan(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ------------------------------------------------------------------ */
/* Safety: block / unblock / report                                    */
/* ------------------------------------------------------------------ */

export const blockUser = mutation({
  args: { ...fanArgs, contactId: v.id("fans") },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    if (args.contactId === me._id) throw new Error("Você não pode bloquear a si mesmo.");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("blockedId", args.contactId))
      .unique();
    if (!existing) {
      await ctx.db.insert("blocks", {
        ownerId: me._id,
        blockedId: args.contactId,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const unblockUser = mutation({
  args: { ...fanArgs, contactId: v.id("fans") },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const row = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("ownerId", me._id).eq("blockedId", args.contactId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

export const listBlocked = query({
  args: fanArgs,
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    const rows = await ctx.db
      .query("blocks")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    const out = [];
    for (const row of rows) {
      const fan = await ctx.db.get(row.blockedId);
      if (fan) out.push({ fanId: fan._id, name: fan.name, fanNumber: fan.fanNumber });
    }
    return out;
  },
});

/** Sends a report to the moderation queue (reviewed by the creator). */
export const reportUser = mutation({
  args: { ...fanArgs, contactId: v.id("fans"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireFan(ctx, args);
    if (args.contactId === me._id) throw new Error("Você não pode denunciar a si mesmo.");
    const target = await ctx.db.get(args.contactId);
    if (!target) throw new Error("Membro não encontrado.");
    await ctx.db.insert("reports", {
      reporterId: me._id,
      reportedId: args.contactId,
      reason: (args.reason ?? "").trim().slice(0, 300) || undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
