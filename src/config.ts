export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://qwfp:qwfp@localhost:5432/qwfp",
  nodeEnv: process.env.NODE_ENV || "development",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePrices: {
    essentials: process.env.STRIPE_PRICE_ESSENTIALS || "price_essentials",
    pro: process.env.STRIPE_PRICE_PRO || "price_pro",
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise",
  },
  appUrl: process.env.APP_URL || "http://localhost:5173",
} as const;
