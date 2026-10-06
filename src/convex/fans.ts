import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/* ------------------------------------------------------------------ */
/* Session verification — every function below requires a valid secret. */
/* ------------------------------------------------------------------ */

export async function requireFan(
  ctx: QueryCtx | MutationCtx,
  args: { fanId: Id<"fans">; secret: string },
): Promise<Doc<"fans">> {
  const fan = await ctx.db.get(args.fanId);
  if (!fan || fan.secret !== args.secret) {
    throw new Error("Sessão inválida. Crie seu perfil de fã novamente.");
  }
  return fan;
}

/** Next free fan number. Starts at 10 and steps by 10 (matches #10, #20 …). */
async function nextFanNumber(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db
    .query("counters")
    .withIndex("by_key", (q) => q.eq("key", "fanNumber"))
    .unique();
  if (!row) {
    await ctx.db.insert("counters", { key: "fanNumber", value: 10 });
    return 10;
  }
  const next = row.value + 10;
  await ctx.db.patch(row._id, { value: next });
  return next;
}

/** The official ByronBS account every member sees as first contact. */
export async function ensureOfficialFan(ctx: MutationCtx): Promise<Doc<"fans">> {
  const existing = await ctx.db
    .query("fans")
    .withIndex("by_number", (q) => q.eq("fanNumber", 1))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("fans", {
    name: "ByronBS",
    fanNumber: 1,
    secret: crypto.randomUUID(),
    isOfficial: true,
    createdAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates a fan profile and returns an exclusive, never-repeated fan number.
 * The secret is returned exactly once and must be stored by the client.
 */
export const join = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 24) {
      throw new Error("O nome ou apelido deve ter entre 2 e 24 caracteres.");
    }
    if (/[^\p{L}\p{N} ._-]/u.test(name)) {
      throw new Error("Use apenas letras, números, espaço, ponto, traço ou underline.");
    }

    const official = await ensureOfficialFan(ctx);
    const fanNumber = await nextFanNumber(ctx);
    const secret = crypto.randomUUID();
    const fanId = await ctx.db.insert("fans", {
      name,
      fanNumber,
      secret,
      createdAt: Date.now(),
    });

    // The official ⭐ ByronBS contact shows up automatically from day one.
    await ctx.db.insert("contacts", {
      ownerId: fanId,
      contactId: official._id,
      createdAt: Date.now(),
    });

    return { fanId, secret, name, fanNumber };
  },
});

/** Re-reads the profile for a stored session (validates the secret). */
export const me = query({
  args: { fanId: v.id("fans"), secret: v.string() },
  handler: async (ctx, args) => {
    const fan = await requireFan(ctx, args);
    return {
      fanId: fan._id,
      name: fan.name,
      fanNumber: fan.fanNumber,
      isOfficial: fan.isOfficial ?? false,
    };
  },
});

/** Finds a member by their public fan number (for “Adicionar contato”). */
export const findByNumber = query({
  args: { fanId: v.id("fans"), secret: v.string(), number: v.number() },
  handler: async (ctx, args) => {
    await requireFan(ctx, args);
    const found = await ctx.db
      .query("fans")
      .withIndex("by_number", (q) => q.eq("fanNumber", args.number))
      .unique();
    if (!found) return null;
    return {
      fanId: found._id,
      name: found.name,
      fanNumber: found.fanNumber,
      isOfficial: found.isOfficial ?? false,
    };
  },
});
