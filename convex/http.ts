import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "./_generated/api";
import stripe from "../src/lib/stripe";
const http = httpRouter();
const clerkWebhook = httpAction(async (ctx, request) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;
  console.log(webhookSecret, "---- webhook secret");
  if (!webhookSecret) {
    throw new Error("Invalid client webhook secret environment variable");
  }
  const svix_id = request.headers.get("svix-id");
  const svix_signature = request.headers.get("svix-signature");
  const svix_timestamp = request.headers.get("svix-timestamp");
  if (!svix_id || !svix_signature || !svix_timestamp) {
    throw new Error("Missing Clerk SVIX headers");
  }
  const payload = await request.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (e) {
    console.log(e);
    throw new Error("Invalid Clerk SVIX signature");
  }
  switch (evt.type) {
    case "user.created":
      const { id, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses[0]?.email_address;
      const name = `${first_name} ${last_name}`.trim();
      try {
        const customer = await stripe.customers.create({
          email,
          name,
          metadata: {
            clerkId: id,
          },
        });
        await ctx.runMutation(api.user.createUser, {
          clerkId: id,
          email,
          name,
          stripeCustomerId: customer.id,
        });
      } catch (e) {
        console.log(e);
      }
      return new Response("OK", { status: 200 });

    default:
      throw new Error(`Unsupported Clerk webhook event type: ${evt.type}`);
  }
});
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: clerkWebhook,
});
export default http;
