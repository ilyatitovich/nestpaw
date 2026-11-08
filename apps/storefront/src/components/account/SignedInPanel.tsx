import type { FormEvent } from "react";
import type { FieldErrors, FormNotice } from "../../lib/account-validation";
import {
  type AccountLabels,
  type AccountOrder,
  formatOrderTotal,
} from "../../lib/customer-account";
import AccountMessage from "./AccountMessage";
import FieldError from "./FieldError";

type Props = {
  labels: AccountLabels;
  customerEmail: string | null;
  orders: AccountOrder[];
  needsName: boolean;
  firstName: string;
  lastName: string;
  firstNameId: string;
  lastNameId: string;
  firstNameErrorId: string;
  lastNameErrorId: string;
  busy: boolean;
  notice: FormNotice | null;
  fieldErrors: FieldErrors;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onFirstNameBlur: () => void;
  onLastNameBlur: () => void;
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
  firstNameId,
  lastNameId,
  firstNameErrorId,
  lastNameErrorId,
  busy,
  notice,
  fieldErrors,
  onFirstNameChange,
  onLastNameChange,
  onFirstNameBlur,
  onLastNameBlur,
  onSaveProfile,
  onLogout,
}: Props) {
  return (
    <div className="account-panel account-panel--signed-in">
      <p className="account-panel__signed-in">
        {labels.signedInAs} <strong>{customerEmail}</strong>
      </p>

      {needsName ? (
        <form className="account-form" onSubmit={onSaveProfile} noValidate>
          <div className="account-field">
            <label htmlFor={firstNameId}>{labels.nameFirst}</label>
            <input
              id={firstNameId}
              name="given-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              onBlur={onFirstNameBlur}
              required
              aria-invalid={Boolean(fieldErrors.firstName) || undefined}
              aria-describedby={
                fieldErrors.firstName ? firstNameErrorId : undefined
              }
            />
            <FieldError id={firstNameErrorId} message={fieldErrors.firstName} />
          </div>
          <div className="account-field">
            <label htmlFor={lastNameId}>{labels.nameLast}</label>
            <input
              id={lastNameId}
              name="family-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              onBlur={onLastNameBlur}
              required
              aria-invalid={Boolean(fieldErrors.lastName) || undefined}
              aria-describedby={
                fieldErrors.lastName ? lastNameErrorId : undefined
              }
            />
            <FieldError id={lastNameErrorId} message={fieldErrors.lastName} />
          </div>
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? labels.saving : labels.saveProfile}
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

      <AccountMessage notice={notice} />
    </div>
  );
}
