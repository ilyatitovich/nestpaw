import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Order = {
  id: string;
  number: number;
  status: string;
  email: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  refundedTotal: number;
  currency: string;
  invoiceNumber: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  lines: {
    title: string;
    quantity: number;
    total: number;
    sku: string;
    taxTotal: number;
  }[];
};

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [carrier, setCarrier] = useState("DHL");
  const [tracking, setTracking] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const order = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get<Order>(`/admin/orders/${id}`),
  });

  const action = useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body?: unknown;
    }) => api.post(path, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
  });

  if (order.isLoading) return <p className="admin-muted">Loading…</p>;
  if (!order.data) return <p>Not found</p>;
  const o = order.data;
  const addr = o.shippingAddress ?? {};

  return (
    <div className="admin-stack">
      <div className="admin-header">
        <h1>
          Order #{o.number} · {o.status}
        </h1>
        {o.invoiceNumber ? (
          <a
            className="admin-btn"
            href={`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/admin/orders/${o.id}/invoice.pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Invoice #{o.invoiceNumber}
          </a>
        ) : null}
      </div>
      <div className="admin-panel admin-stack">
        <p>
          {o.email}
          {o.carrier || o.trackingNumber
            ? ` · Ship: ${o.carrier ?? "—"} ${o.trackingNumber ?? ""}`
            : null}
        </p>
        <p className="admin-muted">
          {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
          <br />
          {addr.line1}
          {addr.line2 ? (
            <>
              <br />
              {addr.line2}
            </>
          ) : null}
          <br />
          {[addr.postalCode, addr.city].filter(Boolean).join(" ")} {addr.country}
          {addr.phone ? (
            <>
              <br />
              {addr.phone}
            </>
          ) : null}
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>VAT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={`${l.sku}:${l.title}:${l.quantity}:${l.total}`}>
                <td>{l.title}</td>
                <td className="admin-mono">{l.sku}</td>
                <td>{l.quantity}</td>
                <td>€{(l.taxTotal / 100).toFixed(2)}</td>
                <td>€{(l.total / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="admin-muted">
          <div>
            Subtotal €{(o.subtotal / 100).toFixed(2)} · Discount €
            {(o.discountTotal / 100).toFixed(2)} · Shipping €
            {(o.shippingTotal / 100).toFixed(2)} · VAT incl. €
            {(o.taxTotal / 100).toFixed(2)}
          </div>
          <div>
            <strong>
              Total €{(o.total / 100).toFixed(2)} {o.currency}
            </strong>
            {o.refundedTotal > 0
              ? ` · Refunded €${(o.refundedTotal / 100).toFixed(2)}`
              : null}
          </div>
        </dl>
        {o.status === "paid" ? (
          <div className="admin-actions" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              placeholder="Carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
            <input
              placeholder="Tracking number"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() =>
                action.mutate({
                  path: `/admin/orders/${o.id}/fulfill`,
                  body: { carrier, trackingNumber: tracking || undefined },
                })
              }
            >
              Fulfill & ship
            </button>
          </div>
        ) : null}
        <div className="admin-actions">
          {["pending_payment", "paid"].includes(o.status) ? (
            <button
              type="button"
              className="admin-btn"
              onClick={() =>
                action.mutate({ path: `/admin/orders/${o.id}/cancel` })
              }
            >
              Cancel
            </button>
          ) : null}
          {user?.role === "owner" &&
          ["paid", "fulfilled"].includes(o.status) ? (
            <>
              <input
                placeholder="Partial refund cents"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() =>
                  action.mutate({
                    path: `/admin/orders/${o.id}/refund`,
                    body: refundAmount
                      ? { amount: Number(refundAmount) }
                      : {},
                  })
                }
              >
                Refund
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
