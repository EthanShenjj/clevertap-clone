import type { SmsMessage, SmsReceiptEvent } from "./sms.ts";

/** Replace values after parsing JSON, so quotes/newlines in SMS text stay data. */
export function renderSmsPayload(
  value: unknown,
  replacements: Record<string, string>,
): unknown {
  if (typeof value === "string")
    return value.replace(/\$\$([A-Za-z][A-Za-z0-9_]*)/g, (_, key: string) => {
      if (!(key in replacements))
        throw new Error("Missing SMS variable: $$" + key);
      return replacements[key];
    });
  if (Array.isArray(value))
    return value.map((v) => renderSmsPayload(v, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        renderSmsPayload(v, replacements),
      ]),
    );
  return value;
}

export function applySmsReceipt(
  message: SmsMessage,
  event: SmsReceiptEvent,
  source: string,
  at = new Date().toISOString(),
): SmsMessage {
  const next = structuredClone(message);
  // Retry and out-of-order receipts must not inflate counters or downgrade terminal states.
  if (next.receipts.some((r) => r.event === event)) return next;
  next.receipts.push({ event, at, source });
  if (event === "clicked") next.clicked = true;
  else if (event === "replied") next.replied = true;
  else if (!["Delivered", "Failed"].includes(next.status)) {
    next.status =
      event === "delivered"
        ? "Delivered"
        : event === "failed"
          ? "Failed"
          : "Sent";
    if (event === "delivered") next.errorCode = "";
    if (event === "failed" && !next.errorCode)
      next.errorCode = "DELIVERY_FAILED";
  }
  next.updatedAt = at;
  return next;
}

export function smsLength(text: string) {
  const basic =
    /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\\[\]~|€]*$/;
  const gsm = basic.test(text);
  const units = gsm
    ? [...text].reduce((n, c) => n + ("^{}\\[]~|€".includes(c) ? 2 : 1), 0)
    : text.length;
  const single = gsm ? 160 : 70,
    multi = gsm ? 153 : 67;
  return {
    encoding: gsm ? "GSM-7" : "Unicode",
    units,
    parts: units <= single ? 1 : Math.ceil(units / multi),
  };
}
