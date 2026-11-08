import { type FormEvent, useId } from "react";
import {
  type AccountLabels,
  type AccountOrder,
  formatOrderTotal,
} from "../../lib/customer-account";
import AccountMessage from "./AccountMessage";

type Props = {
  labels: AccountLabels;
  customerEmail: string | null;
  orders: AccountOrder[];
  needsName: boolean;
  firstName: string;
  lastName: string;
  busy: boolean;
  message: string | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onSaveProfile: (e: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
};

export default function SignedInPanel({
  labels,
  customerEmail,
  orders,
  needsName,
  firstName,
  lastName,
  busy,
  message,
  onFirstNameChange,
  onLastNameChange,
  onSaveProfile,
  onLogout,
}: Props) {
  const baseId = useId();

  return (
    <div className="account-panel account-panel--signed-in">
      <p className="account-panel__signed-in">
        {labels.signedInAs} <strong>{customerEmail}</strong>
      </p>

      {needsName ? (
        <form className="account-form" onSubmit={onSaveProfile}>
          <div className="account-field">
            <label htmlFor={`${baseId}-first`}>{labels.nameFirst}</label>
            <input
              id={`${baseId}-first`}
              name="given-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              required
            />
          </div>
          <div className="account-field">
            <label htmlFor={`${baseId}-last`}>{labels.nameLast}</label>
            <input
              id={`${baseId}-last`}
              name="family-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {labels.saveProfile}
          </button>
        </form>
      ) : null}

      <button type="button" className="btn btn--ghost" onClick={onLogout}>
        {labels.logout}
      </button>

      <h2 className="account-panel__orders-title">{labels.orders}</h2>
      {!orders.length ? (
        <p className="account-panel__empty">{labels.noOrders}</p>
      ) : null}
      <div className="order-list">
        {orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div>
              <strong>#{order.number}</strong>
              <div className="order-row__meta">
                {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                {order.status}
              </div>
            </div>
            <div>{formatOrderTotal(order)}</div>
          </div>
        ))}
      </div>

      <AccountMessage message={message} />
    </div>
  );
}
