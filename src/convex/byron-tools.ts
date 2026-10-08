import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireByronSession } from "./byron";
import { requireFan } from "./fans";

/* ------------------------------------------------------------------ */
/* Fan-facing tool access that the admin panel reads/writes            */
/* ------------------------------------------------------------------ */

export const fanProfileByNameAndNumber = query({
  args: { name: v.string(), number: v.number() },
  handler: async (ctx, args) => {
    const fan = await ctx.db
      .query("fans")
      .withIndex("by_number", (q) => q.eq("fanNumber", args.number))
      .unique();
    if (!fan) return null;
    if (fan.name.toLowerCase() !== args.name.toLowerCase()) return null;
    return {
      fanId: fan._id,
      name: fan.name,
      fanNumber: fan.fanNumber,
      isOfficial: fan.isOfficial ?? false,
      createdAt: fan.createdAt,
    };
  },
});

export const fanGroups = query({
  args: { fanId: v.id("fans") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.fanId))
      .collect();
    const ids = [...new Set(rows.map((r) => r.groupId))];
    const out = [];
    for (const id of ids) {
      const group = await ctx.db.get(id);
      if (!group) continue;
      const memberRow = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", id).eq("fanId", args.fanId))
        .unique();
      out.push({
        groupId: group._id,
        name: group.name,
        coverUrl: group.coverUrl ?? null,
        description: group.description ?? null,
        role: memberRow?.role ?? "member",
      });
    }
    return out;
  },
});

export const fanContactsList = query({
  args: { fanId: v.id("fans") },
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
      out.push({
        fanId: other._id,
        name: other.name,
        fanNumber: other.fanNumber,
        isOfficial: other.isOfficial ?? false,
        lastMessage: last
          ? { kind: last.kind, body: last.kind === "text" ? (last.body ?? "") : "", fromMe: last.fromId === args.fanId, createdAt: last.createdAt }
          : null,
        createdAt: row.createdAt,
      });
    }
    out.sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

export const createGroup = mutation({
  args: {
    sid: v.string(),
    name: v.string(),
    coverUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    rules: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("fans"))),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    if (args.name.trim().length < 2 || args.name.trim().length > 60) {
      throw new Error("Nome do grupo deve ter de 2 a 60 caracteres.");
    }
    const now = Date.now();
    const groupId = await ctx.db.insert("groups", {
      name: args.name.trim(),
      coverUrl: args.coverUrl,
      description: args.description?.trim() || undefined,
      rules: args.rules?.trim() || undefined,
      ownerId: args.memberIds?.[0] ?? (await ctx.db.get(args.memberIds?.[0] ?? ctx.db.insert("fans", { name: "Sem membro", fanNumber: 0, secret: crypto.randomUUID(), createdAt: now } as any)) as Id<"fans">),
      createdAt: now,
    });
    return { groupId };
  },
});

export const listAdminGroups = query({
  args: { sid: v.string() },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const rows = await ctx.db.query("groups").collect();
    const out = [];
    for (const g of rows) {
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .collect();
      const memberBrefs = [];
      for (const m of members) {
        const fan = await ctx.db.get(m.fanId);
        if (!fan) continue;
        memberBrefs.push({
          fanId: fan._id,
          name: fan.name,
          fanNumber: fan.fanNumber,
          isOfficial: fan.isOfficial ?? false,
          role: m.role,
          createdAt: m.createdAt,
        });
      }
      out.push({
        groupId: g._id,
        name: g.name,
        coverUrl: g.coverUrl ?? null,
        description: g.description ?? null,
        rules: g.rules ?? null,
        ownerId: g.ownerId,
        memberCount: members.length,
        members: memberBrefs,
        createdAt: g.createdAt,
      });
    }
    return out;
  },
});

export const updateGroup = mutation({
  args: {
    sid: v.string(),
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    rules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Grupo não encontrado.");
    await ctx.db.patch(args.groupId, {
      name: args.name !== undefined ? args.name.trim() : group.name,
      coverUrl: args.coverUrl,
      description: args.description !== undefined ? args.description.trim() : group.description,
      rules: args.rules !== undefined ? args.rules.trim() : group.rules,
    });
    return { ok: true };
  },
});

export const deleteGroup = mutation({
  args: { sid: v.string(), groupId: v.id("groups") },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Grupo não encontrado.");
    await ctx.db.delete(args.groupId);
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    return { ok: true };
  },
});

export const addGroupMember = mutation({
  args: {
    sid: v.string(),
    groupId: v.id("groups"),
    fanId: v.id("fans"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId).eq("fanId", args.fanId))
      .unique();
    if (existing) throw new Error("Membro já participa do grupo.");
    const fan = await ctx.db.get(args.fanId);
    if (!fan) throw new Error("Fã não encontrado.");
    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      fanId: args.fanId,
      role: args.role,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeGroupMember = mutation({
  args: {
    sid: v.string(),
    groupId: v.id("groups"),
    fanId: v.id("fans"),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const row = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId).eq("fanId", args.fanId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Polls                                                               */
/* ------------------------------------------------------------------ */

export const createPoll = mutation({
  args: {
    sid: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    isMulti: v.optional(v.boolean()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    if (args.question.trim().length < 4) {
      throw new Error("A pergunta deve ter pelo menos 4 caracteres.");
    }
    if (args.options.length < 2) {
      throw new Error("A enquete precisa de pelo menos 2 opções.");
    }
    if (args.options.some((o) => o.trim().length < 2)) {
      throw new Error("Cada opção deve ter pelo menos 2 caracteres.");
    }
    const id = crypto.randomUUID();
    const optionRows = args.options.map((text) => ({
      id: crypto.randomUUID().slice(0, 8),
      text: text.trim(),
      totalVotes: 0,
    }));
    const pollId = await ctx.db.insert("polls", {
      ownerId: (await ctx.db.get(args.sid)) as any,
      question: args.question.trim(),
      options: optionRows,
      isMulti: args.isMulti ?? false,
      endsAt: args.endsAt,
      createdAt: Date.now(),
    });
    return { pollId };
  },
});

export const adminListPolls = query({
  args: { sid: v.string() },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const rows = await ctx.db.query("polls").collect();
    const out = [];
    for (const p of rows) {
      out.push({
        pollId: p._id,
        question: p.question,
        options: p.options,
        isMulti: p.isMulti,
        endsAt: p.endsAt ?? null,
        createdAt: p.createdAt,
      });
    }
    return out;
  },
});

export const deletePoll = mutation({
  args: { sid: v.string(), pollId: v.id("polls") },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Enquete não encontrada.");
    await ctx.db.delete(args.pollId);
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();
    for (const v of votes) await ctx.db.delete(v._id);
    return { ok: true };
  },
});

export const votePoll = mutation({
  args: {
    sid: v.string(),
    pollId: v.id("polls"),
    optionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Enquete não encontrada.");
    if (poll.endsAt && Date.now() > poll.endsAt) throw new Error("Esta enquete já encerrou.");
    const voter = await requireFan(ctx, { fanId: session.userPrincipalId as any, secret: crypto.randomUUID() });
    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId).eq("voterId", voter._id))
      .unique();
    const newValues = new Set(args.optionIds.map((o) => o.trim()));
    if (newValues.size < 1) throw new Error("Selecione pelo menos uma opção.");
    if (existing) {
      const prev = new Set(existing.optionIds);
      for (const opt of poll.options) {
        const still = newValues.has(opt.id);
        const was = prev.has(opt.id);
        if (still && !was) opt.totalVotes += 1;
        if (!still && was) opt.totalVotes -= 1;
      }
      await ctx.db.patch(existing._id, { optionIds: args.optionIds });
      return { ok: true, updated: true };
    }
    for (const opt of poll.options) {
      if (newValues.has(opt.id)) opt.totalVotes += 1;
    }
    await ctx.db.insert("pollVotes", {
      pollId: args.pollId,
      voterId: voter._id,
      optionIds: args.optionIds,
      createdAt: Date.now(),
    });
    return { ok: true, updated: false };
  },
});

/* ------------------------------------------------------------------ */
/* Posts / feed                                                        */
/* ------------------------------------------------------------------ */

export const createPost = mutation({
  args: {
    sid: v.string(),
    kind: v.union(v.literal("post"), v.literal("announcement")),
    title: v.optional(v.string()),
    body: v.string(),
    postUrl: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const body = args.body.trim();
    if (body.length < 1) throw new Error("A publicação precisa de texto.");
    if (body.length > 4000) throw new Error("Texto muito longo (máx. 4000 caracteres).");
    const fan = await ctx.db.get(args.sid as any);
    if (!fan) throw new Error("Usuário não encontrado.");
    const postId = await ctx.db.insert("posts", {
      ownerId: fan._id as Id<"fans">,
      kind: args.kind,
      title: args.title?.trim() || undefined,
      body,
      postUrl: args.postUrl,
      reactionTotals: { like: 0, love: 0 },
      createdAt: Date.now(),
    });
    return { postId };
  },
});

export const adminListPosts = query({
  args: { sid: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_created", (q) => q.order("desc"))
      .take(args.limit ?? 200);
    const out = [];
    for (const p of rows) {
      const owner = await ctx.db.get(p.ownerId);
      const reactions = await ctx.db
        .query("postReactions")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect();
      const totals = { like: 0, love: 0 };
      for (const r of reactions) {
        if (r.value === "like") totals.like += 1;
        else if (r.value === "love") totals.love += 1;
      }
      const comments = await ctx.db
        .query("postComments")
        .withIndex("by_post_created", (q) => q.eq("postId", p._id))
        .collect();
      const commentBrefs = [];
      for (const c of comments) {
        const author = await ctx.db.get(c.fromId);
        if (!author) continue;
        commentBrefs.push({
          commentId: c._id,
          fromId: author._id,
          name: author.name,
          fanNumber: author.fanNumber,
          body: c.body,
          createdAt: c.createdAt,
        });
      }
      out.push({
        postId: p._id,
        ownerId: p.ownerId,
        ownerName: owner?.name ?? "Desconhecido",
        ownerFanNumber: owner?.fanNumber ?? 0,
        ownerIsOfficial: owner?.isOfficial ?? false,
        kind: p.kind,
        title: p.title ?? null,
        body: p.body,
        postUrl: p.postUrl ? await ctx.storage.getUrl(p.postUrl) : null,
        reactionTotals: totals,
        commentCount: comments.length,
        comments: commentBrefs,
        createdAt: p.createdAt,
      });
    }
    return out;
  },
});

export const deletePost = mutation({
  args: { sid: v.string(), postId: v.id("posts") },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicação não encontrada.");
    await ctx.db.delete(args.postId);
    const reactions = await ctx.db
      .query("postReactions")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);
    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post_created", (q) => q.eq("postId", args.postId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    return { ok: true };
  },
});

export const reactToPost = mutation({
  args: { sid: v.string(), postId: v.id("posts"), value: v.union(v.literal("like"), v.literal("love"), v.literal("none")) },
  handler: async (ctx, args) => {
    const session = await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicação não encontrada.");
    if (post.ownerId === session.userPrincipalId as any) throw new Error("Não é possível reagir à sua própria publicação.");
    const fan = await requireFan(ctx, { fanId: session.userPrincipalId as any, secret: crypto.randomUUID() });
    const existing = await ctx.db
      .query("postReactions")
      .withIndex("by_fan_post", (q) => q.eq("fanId", fan._id).eq("postId", args.postId))
      .unique();
    const delta = (prev: string | undefined, next: string) => {
      if (prev === next) return { like: 0, love: 0 };
      if (prev === "like" && next === "love") return { like: -1, love: 1 };
      if (prev === "love" && next === "like") return { like: 1, love: -1 };
      if (!prev && next === "like") return { like: 1, love: 0 };
      if (!prev && next === "love") return { like: 0, love: 1 };
      if (prev === "like" && !next) return { like: -1, love: 0 };
      if (prev === "love" && !next) return { like: 0, love: -1 };
      return { like: 0, love: 0 };
    };
    if (existing) {
      const diff = delta(existing.value, args.value);
      await ctx.db.patch(args.postId, {
        reactionTotals: {
          like: (post.reactionTotals?.like ?? 0) + diff.like,
          love: (post.reactionTotals?.love ?? 0) + diff.love,
        },
      });
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: Date.now() });
    } else {
      const diff = delta(undefined, args.value);
      await ctx.db.insert("postReactions", {
        fanId: fan._id,
        postId: args.postId,
        value: args.value,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(args.postId, {
        reactionTotals: {
          like: (post.reactionTotals?.like ?? 0) + diff.like,
          love: (post.reactionTotals?.love ?? 0) + diff.love,
        },
      });
    }
    return { ok: true };
  },
});

export const addPostComment = mutation({
  args: { sid: v.string(), postId: v.id("posts"), body: v.string() },
  handler: async (ctx, args) => {
    const session = await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const fan = await requireFan(ctx, { fanId: session.userPrincipalId as any, secret: crypto.randomUUID() });
    const body = args.body.trim();
    if (body.length < 1) throw new Error("O comentário precisa de texto.");
    if (body.length > 1000) throw new Error("Comentário muito longo (máx. 1000 caracteres).");
    await ctx.db.insert("postComments", {
      postId: args.postId,
      fromId: fan._id,
      body,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deletePostComment = mutation({
  args: { sid: v.string(), commentId: v.id("postComments") },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comentário não encontrado.");
    if (comment.fromId !== (await requireByronSession(ctx, { sid: args.sid } as { sid: string })).userPrincipalId as any) {
      throw new Error("Só o autor pode remover o comentário.");
    }
    await ctx.db.delete(args.commentId);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export const createEvent = mutation({
  args: {
    sid: v.string(),
    name: v.string(),
    coverUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    if (args.name.trim().length < 2) throw new Error("Nome do evento é necessário.");
    const fan = await ctx.db.get(args.sid as any);
    if (!fan) throw new Error("Usuário não encontrado.");
    const eventId = await ctx.db.insert("events", {
      ownerId: fan._id as Id<"fans">,
      name: args.name.trim(),
      coverUrl: args.coverUrl,
      description: args.description?.trim() || undefined,
      location: args.location?.trim() || undefined,
      startsAt: args.startsAt,
      body: args.body?.trim() || undefined,
      createdAt: Date.now(),
    });
    return { eventId };
  },
});

export const adminListEvents = query({
  args: { sid: v.string() },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const rows = await ctx.db.query("events").collect();
    const out = [];
    for (const e of rows) {
      const owner = await ctx.db.get(e.ownerId);
      out.push({
        eventId: e._id,
        ownerId: e.ownerId,
        ownerName: owner?.name ?? "Desconhecido",
        ownerFanNumber: owner?.fanNumber ?? 0,
        name: e.name,
        coverUrl: e.coverUrl ?? null,
        description: e.description ?? null,
        location: e.location ?? null,
        startsAt: e.startsAt ?? null,
        body: e.body ?? null,
        createdAt: e.createdAt,
      });
    }
    return out;
  },
});

export const deleteEvent = mutation({
  args: { sid: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireByronSession(ctx, { sid: args.sid } as { sid: string });
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Evento não encontrado.");
    await ctx.db.delete(args.eventId);
    return { ok: true };
  },
});
