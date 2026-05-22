export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  ownerNotificationWebhookUrl: process.env.OWNER_NOTIFICATION_WEBHOOK_URL ?? "",
  // Optional Zaico API values. They are not required in local DB mode.
  zaicoApiToken: process.env.ZAICO_API_TOKEN ?? "",
  zaicoOperatorDefaultName: process.env.ZAICO_OPERATOR_DEFAULT_NAME ?? "野田",
  zaicoOperatorDefaultEmail: process.env.ZAICO_OPERATOR_DEFAULT_EMAIL ?? "",
  zaicoOperatorAName: process.env.ZAICO_OPERATOR_A_NAME ?? "",
  zaicoOperatorAToken: process.env.ZAICO_OPERATOR_A_TOKEN ?? "",
  zaicoOperatorAEmail: process.env.ZAICO_OPERATOR_A_EMAIL ?? "",
  zaicoOperatorBName: process.env.ZAICO_OPERATOR_B_NAME ?? "",
  zaicoOperatorBToken: process.env.ZAICO_OPERATOR_B_TOKEN ?? "",
  zaicoOperatorBEmail: process.env.ZAICO_OPERATOR_B_EMAIL ?? "",
  // GAS Webhook認証用シークレットキー
  gasWebhookSecret: process.env.GAS_WEBHOOK_SECRET ?? "",
};
