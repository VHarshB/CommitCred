// Public inference stays disabled until the deployment has a verified client
// identity and durable quotas. Forwarding headers are never used for billing.
export function smartEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.AI_LOCAL_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
}
