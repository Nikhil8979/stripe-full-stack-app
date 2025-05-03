import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const { email, name, clerkId, stripeCustomerId } = args;
    console.log(clerkId, "---- clerkId");
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (existingUser) {
      return existingUser._id;
    }
    const userId = await ctx.db.insert("users", {
      clerkId: clerkId,
      email,
      name,
      stripeCustomerId,
    });
    return userId;
  },
});
export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});
export const getUserByStripeCustomerId = query({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
  },
});
export const getUserAccess = query({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    //check for subscription
    if (user.currentSubscriptionId) {
      const subscription = await ctx.db.get(user.currentSubscriptionId);
      if (subscription?.status === "active") {
        return {
          hasAccess: true,
          accessType: "subscription",
        };
      }
    }
    // check for individual course access
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();
    if (purchase.length > 0) {
      return {
        hasAccess: true,
        accessType: "course",
      };
    }
    return {
      hasAccess: false,
      accessType: "none",
    };
  },
});
