import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    clerkId: v.string(),
    stripeCustomerId: v.string(),
    currentSubscriptionId: v.optional(v.id("subscriptions")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),
  courses: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    imageUrl: v.string(),
  }),
  purchases: defineTable({
    price: v.number(),
    courseId: v.id("courses"),
    userId: v.id("users"),
    purchaseDate: v.number(),
    stripePurchaseId: v.string(),
  }).index("by_userId_courseId", ["userId", "courseId"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    planType: v.union(v.literal("month"), v.literal("year")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    cancelAtPeriodEnd: v.boolean(),
  }).index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),
});
