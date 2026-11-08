import type { FormNotice } from "../../lib/account-validation";
import type { AuthMode } from "../../lib/customer-account";

type Props = {
  id?: string;
  notice: FormNotice | null;
  onAction?: (mode: AuthMode) => void;
};

export default function AccountMessage({ id, notice, onAction }: Props) {
  if (!notice) return null;
  return (
    <div
      id={id}
      className={
        notice.tone === "error"
          ? "account-message account-message--error"
          : "account-message account-message--success"
      }
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
    >
      <p className="account-message__text">{notice.text}</p>
      {notice.action && onAction ? (
        <button
          type="button"
          className="account-message__action"
          onClick={() => {
            if (notice.action) onAction(notice.action.mode);
          }}
        >
          {notice.action.label}
        </button>
      ) : null}
    </div>
  );
}
