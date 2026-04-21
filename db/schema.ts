import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Session = typeof sessions.$inferSelect;

export const keys = sqliteTable(
  "keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorIdentifier: text("actor_identifier").notNull(),
    type: text("type", { enum: ["RSASSA-PKCS1-v1_5", "Ed25519"] }).notNull(),
    privateKey: text("private_key").notNull(),
    publicKey: text("public_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("keys_actor_type_idx").on(table.actorIdentifier, table.type),
  ],
);

export type Key = typeof keys.$inferSelect;

export const communities = sqliteTable("communities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;

export const follows = sqliteTable(
  "follows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    followerUri: text("follower_uri").notNull(),
    followerInbox: text("follower_inbox").notNull(),
    followerSharedInbox: text("follower_shared_inbox"),
    followedUri: text("followed_uri").notNull(),
    accepted: integer("accepted", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("follows_pair_idx").on(table.followerUri, table.followedUri),
  ],
);

export type Follow = typeof follows.$inferSelect;
