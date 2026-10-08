import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // --- Comunidade ByronBS: perfil de fã + chat -------------------------

    fans: defineTable({
      name: v.string(),
      fanNumber: v.number(), // unique public id (#10, #20, ...), never personal data
      secret: v.string(), // session secret, never returned to clients
      isOfficial: v.optional(v.boolean()), // the ByronBS creator account
      createdAt: v.number(),
    })
      .index("by_number", ["fanNumber"]),

    counters: defineTable({
      key: v.string(),
      value: v.number(),
    }).index("by_key", ["key"]),

    contacts: defineTable({
      ownerId: v.id("fans"),
      contactId: v.id("fans"),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_contact", ["contactId"])
      .index("by_pair", ["ownerId", "contactId"]),

    messages: defineTable({
      fromId: v.id("fans"),
      toId: v.id("fans"),
      conversationId: v.string(), // sorted "a_b" pair of fan ids
      kind: v.union(v.literal("text"), v.literal("image"), v.literal("audio")),
      body: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      readAt: v.number(), // 0 = unread, timestamp = read (enables indexed unread counts)
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId", "createdAt"])
      .index("by_to_unread", ["toId", "readAt"])
      .index("by_to_created", ["toId", "createdAt"])
      .index("by_from_created", ["fromId", "createdAt"]),

    blocks: defineTable({
      ownerId: v.id("fans"),
      blockedId: v.id("fans"),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_target", ["blockedId"])
      .index("by_pair", ["ownerId", "blockedId"]),

    reports: defineTable({
      reporterId: v.id("fans"),
      reportedId: v.id("fans"),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_reported", ["reportedId"]),
  },
  {
    schemaValidation: false,
  },
);

/* ---------- Admin session (ByronBS login) ---------- */

const byronSessionIndex = defineTable({
  sid: v.string(),
  userPrincipalId: v.string(),
  createdAt: v.number(),
})
  .index("by_sid", ["sid"])
  .index("by_userPrincipal", ["userPrincipalId"]);

/* ---------- Fan groups ---------- */

export const groupRoleValidator = v.union(
  v.literal("admin"),
  v.literal("member"),
);
export type GroupRole = Infer<typeof groupRoleValidator>;

const groups = defineTable({
  name: v.string(),
  coverUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  rules: v.optional(v.string()),
  ownerId: v.id("fans"),
  createdAt: v.number(),
}).index("by_owner", ["ownerId"]);

const groupMembers = defineTable({
  groupId: v.id("groups"),
  fanId: v.id("fans"),
  role: groupRoleValidator,
  createdAt: v.number(),
}).index("by_group", ["groupId"]);

/* ---------- Polls ---------- */

const polls = defineTable({
  ownerId: v.id("fans"),
  question: v.string(),
  options: v.array(
    v.object({
      id: v.string(),
      text: v.string(),
      totalVotes: v.number(),
    }),
  ),
  isMulti: v.boolean(),
  endsAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_owner", ["ownerId"]);

const pollVotes = defineTable({
  pollId: v.id("polls"),
  voterId: v.id("fans"),
  optionIds: v.array(v.string()),
  createdAt: v.number(),
}).index("by_poll", ["pollId"]);

/* ---------- Posts / feed ---------- */

const posts = defineTable({
  ownerId: v.id("fans"),
  kind: v.union(v.literal("post"), v.literal("announcement")),
  title: v.optional(v.string()),
  body: v.string(),
  postUrl: v.optional(v.id("_storage")),
  reactionTotals: v.optional(v.object({
    like: v.number(),
    love: v.number(),
  })),
  createdAt: v.number(),
}).index("by_owner", ["ownerId"])
  .index("by_created", ["createdAt"]);

const postReactions = defineTable({
  fanId: v.id("fans"),
  postId: v.id("posts"),
  value: v.union(v.literal("like"), v.literal("love"), v.literal("none")),
  updatedAt: v.number(),
}).index("by_post", ["postId"])
  .index("by_fan_post", ["fanId", "postId"]);

const postComments = defineTable({
  postId: v.id("posts"),
  fromId: v.id("fans"),
  body: v.string(),
  createdAt: v.number(),
}).index("by_post_created", ["postId", "createdAt"]);

/* ---------- Events ---------- */

const events = defineTable({
  ownerId: v.id("fans"),
  name: v.string(),
  coverUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  startsAt: v.optional(v.number()),
  body: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_owner", ["ownerId"])
  .index("by_startsAt", ["startsAt"]);

/* ---------- Note on fan auth ----------

   The fan UX is session-based via an opaque `secret` stored in localStorage
   (`src/lib/fan-session.ts`). The fan table already holds that secret, and
   every fan function calls `requireFan(...)`. No email/social auth is stored
   for fans, which keeps the implementation simple and on-server.

/* ------------------------------------------------------------------ */
/* Schema                                                                  */
/* ------------------------------------------------------------------ */

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // --- Comunidade ByronBS: perfil de fã + chat -------------------------

    fans: defineTable({
      name: v.string(),
      fanNumber: v.number(), // unique public id (#10, #20, ...), never personal data
      secret: v.string(), // session secret, never returned to clients
      isOfficial: v.optional(v.boolean()), // the ByronBS creator account
      createdAt: v.number(),
    })
      .index("by_number", ["fanNumber"]),

    counters: defineTable({
      key: v.string(),
      value: v.number(),
    }).index("by_key", ["key"]),

    contacts: defineTable({
      ownerId: v.id("fans"),
      contactId: v.id("fans"),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_contact", ["contactId"])
      .index("by_pair", ["ownerId", "contactId"]),

    messages: defineTable({
      fromId: v.id("fans"),
      toId: v.id("fans"),
      conversationId: v.string(), // sorted "a_b" pair of fan ids
      kind: v.union(v.literal("text"), v.literal("image"), v.literal("audio")),
      body: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      readAt: v.number(), // 0 = unread, timestamp = read (enables indexed unread counts)
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId", "createdAt"])
      .index("by_to_unread", ["toId", "readAt"])
      .index("by_to_created", ["toId", "createdAt"])
      .index("by_from_created", ["fromId", "createdAt"]),

    blocks: defineTable({
      ownerId: v.id("fans"),
      blockedId: v.id("fans"),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_target", ["blockedId"])
      .index("by_pair", ["ownerId", "blockedId"]),

    reports: defineTable({
      reporterId: v.id("fans"),
      reportedId: v.id("fans"),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_reported", ["reportedId"]),

    // --- Admin session + fan groups + polls + posts + events ----
    byronSessionPublic: byronSessionIndex,
    groups,
    groupMembers,
    polls,
    pollVotes,
    posts,
    postReactions,
    postComments,
    events,
  },
  {
    schemaValidation: false,
  },
);

export default schema;
