type Props = {
  id?: string;
  message: string | null;
};

export default function AccountMessage({ id, message }: Props) {
  if (!message) return null;
  return (
    <p id={id} className="account-message" role="status" aria-live="polite">
      {message}
    </p>
  );
}
