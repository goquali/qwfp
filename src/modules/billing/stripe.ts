import Stripe from "stripe";
import { config } from "../../config.js";

// Initialize Stripe (lazy — only when key is available)
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured. Set it in environment variables.");
    }
    stripeClient = new Stripe(config.stripeSecretKey);
  }
  return stripeClient;
}

// Tier → Stripe price ID mapping
const TIER_PRICES: Record<string, string> = {
  essentials: config.stripePrices.essentials,
  pro: config.stripePrices.pro,
  enterprise: config.stripePrices.enterprise,
};

export async function createCheckoutSession(params: {
  subscriptionId: string;
  tier: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const priceId = TIER_PRICES[params.tier];
  if (!priceId) throw new Error(`No Stripe price configured for tier: ${params.tier}`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl || `${config.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl || `${config.appUrl}/pricing`,
    customer_email: params.customerEmail,
    metadata: {
      subscriptionId: params.subscriptionId,
      tier: params.tier,
    },
  });

  return { url: session.url!, sessionId: session.id };
}

export async function createPortalSession(stripeCustomerId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${config.appUrl}/dashboard`,
  });
  return { url: session.url };
}

export async function handleWebhookEvent(payload: string | Buffer, signature: string): Promise<{
  type: string;
  subscriptionId?: string;
  tier?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}> {
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: "checkout_completed",
        subscriptionId: session.metadata?.subscriptionId,
        tier: session.metadata?.tier,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      };
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: "subscription_updated",
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
      };
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        type: "subscription_cancelled",
        stripeSubscriptionId: subscription.id,
      };
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      return {
        type: "payment_succeeded",
        stripeCustomerId: invoice.customer as string,
        stripeSubscriptionId: (invoice as any).subscription as string,
      };
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return {
        type: "payment_failed",
        stripeCustomerId: invoice.customer as string,
      };
    }
    default:
      return { type: event.type };
  }
}

export function isStripeConfigured(): boolean {
  return !!config.stripeSecretKey;
}
