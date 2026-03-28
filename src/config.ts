export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://qwfp:qwfp@localhost:5432/qwfp",
  nodeEnv: process.env.NODE_ENV || "development",
} as const;
