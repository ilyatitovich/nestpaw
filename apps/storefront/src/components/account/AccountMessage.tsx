import type { FormNotice } from "../../lib/account-validation";

type Props = {
  id?: string;
  notice: FormNotice | null;
};

export default function AccountMessage({ id, notice }: Props) {
  if (!notice) return null;
  return (
    <p
      id={id}
      className={
        notice.tone === "error"
          ? "account-message account-message--error"
          : "account-message account-message--success"
      }
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
    >
      {notice.text}
    </p>
  );
}
