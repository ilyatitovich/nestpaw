/** Minimal single-page text PDF (no deps). */
export function buildInvoicePdf(order: {
  invoiceNumber: number | null;
  number: number;
  email: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  refundedTotal: number;
  paidAt: Date | null;
  shippingAddress: unknown;
  lines: {
    title: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxTotal: number;
  }[];
}): Buffer {
  const money = (cents: number) =>
    `${(cents / 100).toFixed(2)} ${order.currency}`;
  const addr =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, string>)
      : {};
  const lines = [
    `Invoice #${order.invoiceNumber}`,
    `Order #${order.number}`,
    `Date: ${(order.paidAt ?? new Date()).toISOString().slice(0, 10)}`,
    `Bill to: ${order.email}`,
    addr.line1 ? `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim() : "",
    addr.line1 ?? "",
    [addr.postalCode, addr.city].filter(Boolean).join(" "),
    addr.country ?? "",
    "",
    ...order.lines.map(
      (l) =>
        `${l.quantity}x ${l.title} (${l.sku})  ${money(l.total)}  VAT ${money(l.taxTotal)}`,
    ),
    "",
    `Subtotal (gross): ${money(order.subtotal)}`,
    order.discountTotal
      ? `Discount: -${money(order.discountTotal)}`
      : "",
    `Shipping: ${money(order.shippingTotal)}`,
    `VAT included: ${money(order.taxTotal)}`,
    `Total: ${money(order.total)}`,
    order.refundedTotal ? `Refunded: ${money(order.refundedTotal)}` : "",
  ].filter((l) => l !== undefined);

  const content = lines
    .map((line, i) => {
      const y = 800 - i * 14;
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      return `BT /F1 10 Tf 50 ${y} Td (${escaped}) Tj ET`;
    })
    .join("\n");

  const stream = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj${stream}endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${obj}\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
