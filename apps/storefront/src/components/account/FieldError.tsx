type Props = {
  id: string;
  message?: string;
};

export default function FieldError({ id, message }: Props) {
  if (!message) return null;
  return (
    <p id={id} className="account-field__error" role="alert">
      {message}
    </p>
  );
}
