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

export default schema;
