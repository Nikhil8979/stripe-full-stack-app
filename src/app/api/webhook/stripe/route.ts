import stripe from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature")!;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    console.log(e);
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
          event.type
        );
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
      default:
        console.log("Unhandled event type: " + event.type);
        break;
    }
  } catch (e) {
    console.log(e);
    return new Response("Error processing webhook", { status: 400 });
  }
  return new Response("OK", { status: 200 });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log("handleCheckoutSessionCompleted", session);
  const courseId = session.metadata?.courseId;
  const stripeCustomerId = session.customer as string;
  if (!courseId || !stripeCustomerId) {
    throw new Error("Missing courseId or stripeCustomerId");
  }
  const user = await convex.query(api.user.getUserByStripeCustomerId, {
    stripeCustomerId: stripeCustomerId,
  });
  if (!user) {
    throw new Error("User not found");
  }
  await convex.mutation(api.purchases.createPurchase, {
    courseId: courseId as Id<"courses">,
    userId: user._id,
    price: session.amount_total as number,
    stripePurchaseId: session.id,
  });
}

async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription,
  eventType: string
) {
  const stripeCustomerId = subscription.customer as string;
  if (!stripeCustomerId) {
    throw new Error("Missing stripeCustomerId");
  }
  const user = await convex.query(api.user.getUserByStripeCustomerId, {
    stripeCustomerId: stripeCustomerId,
  });
  if (!user) {
    throw new Error("User not found");
  }
  try {
    const items = subscription.items.data[0];
    await convex.mutation(api.subscription.upsertSubscription, {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: items.current_period_end,
      currentPeriodStart: items.current_period_start,
      planType: subscription.items.data[0].plan.interval as "month" | "year",
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      userId: user._id,
    });
  } catch (err) {
    console.error(
      `Error processing ${eventType} for subscription ${subscription.id}:`,
      err
    );
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  if (!customerId) {
    throw new Error("Missing customerId");
  }
  const user = await convex.query(api.user.getUserByStripeCustomerId, {
    stripeCustomerId: customerId,
  });
  if (!user) {
    throw new Error("User not found");
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    await convex.mutation(api.subscription.removeSubscription, {
      stripeSubscriptionId: subscription.id,
    });
    console.log(`Successfully deleted subscription ${subscription.id}`);
  } catch (error) {
    console.error(`Error deleting subscription ${subscription.id}:`, error);
  }
}
