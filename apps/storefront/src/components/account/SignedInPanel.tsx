import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { FieldErrors, FormNotice } from "../../lib/account-validation";
import {
  type AccountAddress,
  type AccountLabels,
  type AccountOrder,
  formatAddressLines,
  formatOrderTotal,
} from "../../lib/customer-account";
import { localizePath } from "../../i18n/ui";
import AccountMessage from "./AccountMessage";
import FieldError from "./FieldError";
import ProductCard, { type ProductCardProduct } from "../ProductCard";

type AccountTab = "orders" | "profile" | "wishlist" | "addresses";

type Props = {
  labels: AccountLabels;
  locale: string;
  shopHref: string;
  apiUrl: string;
  customerEmail: string | null;
  orders: AccountOrder[];
  addresses: AccountAddress[];
  wishlistProducts: ProductCardProduct[];
  wishlistStatus: "idle" | "loading" | "ready" | "error";
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
  onWishlistChange: (productId: string, saved: boolean) => void;
};

const TABS: AccountTab[] = ["orders", "profile", "wishlist", "addresses"];

export default function SignedInPanel({
  labels,
  locale,
  shopHref,
  apiUrl,
  customerEmail,
  orders,
  addresses,
  wishlistProducts,
  wishlistStatus,
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
  onWishlistChange,
}: Props) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<AccountTab>("orders");
  const tabRefs = useRef<Partial<Record<AccountTab, HTMLButtonElement | null>>>(
    {},
  );
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const tabLabels: Record<AccountTab, string> = {
    orders: labels.orders,
    profile: labels.profile,
    wishlist: labels.wishlist,
    addresses: labels.addresses,
  };

  useEffect(() => {
    if (fieldErrors.firstName || fieldErrors.lastName) {
      setActiveTab("profile");
    }
  }, [fieldErrors.firstName, fieldErrors.lastName]);

  function selectTab(tab: AccountTab, focus = false) {
    setActiveTab(tab);
    if (focus) tabRefs.current[tab]?.focus();
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, tab: AccountTab) {
    const index = TABS.indexOf(tab);
    if (index < 0) return;

    let next: AccountTab | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = TABS[(index + 1) % TABS.length] ?? null;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = TABS[(index - 1 + TABS.length) % TABS.length] ?? null;
    } else if (e.key === "Home") {
      next = TABS[0] ?? null;
    } else if (e.key === "End") {
      next = TABS[TABS.length - 1] ?? null;
    }

    if (!next) return;
    e.preventDefault();
    selectTab(next, true);
  }

  function panelProps(tab: AccountTab) {
    const selected = activeTab === tab;
    return {
      id: `${baseId}-panel-${tab}`,
      role: "tabpanel" as const,
      "aria-labelledby": `${baseId}-tab-${tab}`,
      tabIndex: selected ? 0 : -1,
      hidden: !selected,
    };
  }

  return (
    <div className="account-hub">
      <header className="account-hub__identity">
        <div className="account-hub__identity-text">
          <p className="account-hub__greeting">
            {labels.signedInAs}
            {displayName ? (
              <>
                {" "}
                <strong>{displayName}</strong>
              </>
            ) : null}
          </p>
          {customerEmail ? (
            <p className="account-hub__email">{customerEmail}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn--ghost account-hub__logout"
          onClick={onLogout}
        >
          {labels.logout}
        </button>
      </header>

      <AccountMessage notice={notice} />

      <div className="account-tabs">
        <div
          className="account-tabs__list"
          role="tablist"
          aria-label={labels.sectionsNav}
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab}`}
                className={
                  selected
                    ? "account-tabs__tab is-active"
                    : "account-tabs__tab"
                }
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab}`}
                tabIndex={selected ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[tab] = el;
                }}
                onClick={() => selectTab(tab)}
                onKeyDown={(e) => onTabKeyDown(e, tab)}
              >
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        <div
          {...panelProps("orders")}
          className="account-tabpanel account-section"
        >
          <h2 className="account-section__title visually-hidden">
            {labels.orders}
          </h2>
          {!orders.length ? (
            <div className="account-section__empty">
              <p className="account-section__empty-text">{labels.noOrders}</p>
              <a className="btn btn--primary" href={shopHref}>
                {labels.continueShopping}
              </a>
            </div>
          ) : (
            <div className="order-list">
              {orders.map((order) => (
                <div className="order-row" key={order.id}>
                  <div>
                    <strong>#{order.number}</strong>
                    <div className="order-row__meta">
                      {new Date(order.createdAt).toLocaleDateString(locale)} ·{" "}
                      <span className="order-row__status">{order.status}</span>
                    </div>
                  </div>
                  <div className="order-row__total">
                    {formatOrderTotal(order)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          {...panelProps("profile")}
          className="account-tabpanel account-section"
        >
          <h2 className="account-section__title visually-hidden">
            {labels.profile}
          </h2>
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
              <FieldError
                id={firstNameErrorId}
                message={fieldErrors.firstName}
              />
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
            <div className="account-field">
              <span className="account-field__label">{labels.email}</span>
              <p className="account-field__readonly">{customerEmail}</p>
              <p className="account-field__hint">{labels.emailReadonly}</p>
            </div>
            <button
              className="btn btn--primary account-form__submit"
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? labels.saving : labels.saveProfile}
            </button>
          </form>
        </div>

        <div
          {...panelProps("wishlist")}
          className="account-tabpanel account-section"
        >
          <h2 className="account-section__title visually-hidden">
            {labels.wishlist}
          </h2>
          {wishlistStatus === "loading" || wishlistStatus === "idle" ? (
            <p className="account-section__empty-text" aria-live="polite">
              {labels.wishlistLoading}
            </p>
          ) : null}
          {wishlistStatus === "error" ? (
            <div className="account-section__empty">
              <p className="account-section__empty-text">
                {labels.wishlistError}
              </p>
              <a className="btn btn--ghost" href={shopHref}>
                {labels.continueShopping}
              </a>
            </div>
          ) : null}
          {wishlistStatus === "ready" && !wishlistProducts.length ? (
            <div className="account-section__empty">
              <p className="account-section__empty-text">
                {labels.wishlistEmpty}
              </p>
              <a className="btn btn--ghost" href={shopHref}>
                {labels.continueShopping}
              </a>
            </div>
          ) : null}
          {wishlistStatus === "ready" && wishlistProducts.length ? (
            <div className="product-grid">
              {wishlistProducts.map((product) => {
                const tr =
                  product.translations.find((x) => x.locale === locale) ??
                  product.translations[0];
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    apiUrl={apiUrl}
                    href={localizePath(locale, `/products/${tr?.slug ?? ""}`)}
                    heading="h3"
                    labels={{
                      from: labels.productFrom,
                      sale: labels.productSale,
                      add: labels.productAdd,
                      wishlist: labels.productWishlist,
                      wishlistAdded: labels.productWishlistAdded,
                      addError: labels.productAddError,
                    }}
                    onWishlistChange={onWishlistChange}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          {...panelProps("addresses")}
          className="account-tabpanel account-section"
        >
          <h2 className="account-section__title visually-hidden">
            {labels.addresses}
          </h2>
          {!addresses.length ? (
            <p className="account-section__empty-text">{labels.noAddresses}</p>
          ) : (
            <ul className="account-address-list">
              {addresses.map((address) => (
                <li className="account-address" key={address.id}>
                  {address.isDefault ? (
                    <span className="account-address__badge">
                      {labels.defaultAddress}
                    </span>
                  ) : null}
                  {formatAddressLines(address).map((line, index) => (
                    <span
                      className="account-address__line"
                      key={`${address.id}-${index}`}
                    >
                      {line}
                    </span>
                  ))}
                  {address.phone ? (
                    <span className="account-address__line">
                      {address.phone}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
