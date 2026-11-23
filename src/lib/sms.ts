export const SMS_PROVIDERS = ["Twilio", "Nexmo", "Other (Generic)"] as const;
export type SmsProviderName = (typeof SMS_PROVIDERS)[number];
export interface SmsSettings {
  integration: "direct" | "connect";
  accountSid: string;
  fromNumber: string;
  serviceSid: string;
  senderId: string;
  templateId: string;
  requireTemplateId: boolean;
  isDefault: boolean;
  credentialRef: string;
  demoBehavior: "accept" | "reject";
  http: {
    method: "GET" | "POST";
    endpoint: string;
    authentication: "none" | "basic" | "oauth2";
    tokenEndpoint: string;
    format: "json" | "form";
    headers: { key: string; value: string }[];
    payload: string;
    batch: boolean;
    batchKey: string;
    batchSize: number;
  };
}
export function defaultSmsSettings(
  integration: "direct" | "connect" = "direct",
): SmsSettings {
  return {
    integration,
    accountSid: "",
    fromNumber: "",
    serviceSid: "",
    senderId: "",
    templateId: "",
    requireTemplateId: false,
    isDefault: false,
    credentialRef: "",
    demoBehavior: "accept",
    http: {
      method: "POST",
      endpoint: "",
      authentication: "none",
      tokenEndpoint: "",
      format: "json",
      headers: [],
      payload:
        '{\n  "to": "$$To",\n  "body": "$$Body",\n  "messageId": "$$MessageID"\n}',
      batch: false,
      batchKey: "messages",
      batchSize: 100,
    },
  };
}
export interface SmsGroup {
  id: string;
  projectId: string;
  name: string;
  providerIds: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
export type SmsDeliveryStatus =
  "Queued" | "Sent" | "Delivered" | "Failed" | "Unknown";
export type SmsReceiptEvent =
  "sent" | "delivered" | "failed" | "clicked" | "replied";
export interface SmsMessage {
  id: string;
  projectId: string;
  providerId: string;
  groupId: string;
  target: string;
  to: string;
  body: string;
  mode: "demo" | "live";
  status: SmsDeliveryStatus;
  providerMessageId: string;
  errorCode: string;
  createdAt: string;
  updatedAt: string;
  clicked: boolean;
  replied: boolean;
  idempotencyKey: string;
  attempts: { providerId: string; outcome: string; errorCode: string }[];
  receipts: { event: SmsReceiptEvent; at: string; source: string }[];
}
export interface SmsStats {
  sent: number;
  delivered: number;
  clicked: number;
  replied: number;
  errors: number;
  deliveryRate: number;
  clickRate: number;
  daily: { date: string; sent: number; delivered: number; errors: number }[];
}
export interface SmsWorkspace {
  providers: import("./types").Channel[];
  groups: SmsGroup[];
  credentials: string[];
  liveEnabled: boolean;
}
export const SMS_RECEIPT_EVENTS: SmsReceiptEvent[] = [
  "delivered",
  "failed",
  "clicked",
  "replied",
];
