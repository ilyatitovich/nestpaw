import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from "@stripe/stripe-js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type PaymentBillingDetails = {
  name: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postal_code: string;
    country: string;
    state?: string;
  };
};

export type PaymentCheckoutHandle = {
  submitAndConfirm: (params: {
    clientSecret: string;
    returnUrl: string;
    billingDetails: PaymentBillingDetails;
  }) => Promise<{ error?: string }>;
  submitElements: () => Promise<{ error?: string }>;
};

type Props = {
  publishableKey: string;
  locale: string;
  amount: number;
  unavailableMessage: string;
};

const PaymentCheckout = forwardRef<PaymentCheckoutHandle, Props>(
  function PaymentCheckout(
    { publishableKey, locale, amount, unavailableMessage },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const stripeRef = useRef<Stripe | null>(null);
    const elementsRef = useRef<StripeElements | null>(null);
    const paymentRef = useRef<StripePaymentElement | null>(null);
    const [ready, setReady] = useState(false);
    const [mountError, setMountError] = useState<string | null>(null);

    useEffect(() => {
      if (!publishableKey || amount <= 0 || !mountRef.current) {
        setReady(false);
        return;
      }

      let cancelled = false;
      let payment: StripePaymentElement | null = null;

      async function init() {
        setReady(false);
        setMountError(null);
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled || !mountRef.current) {
          if (!cancelled && !stripe) {
            setMountError(unavailableMessage);
          }
          return;
        }
        stripeRef.current = stripe;

        const elements = stripe.elements({
          mode: "payment",
          amount,
          currency: "eur",
          locale: locale === "de" ? "de" : "en",
        });
        elementsRef.current = elements;

        payment = elements.create("payment", {
          layout: "accordion",
          fields: {
            billingDetails: "never",
          },
        });
        paymentRef.current = payment;
        payment.mount(mountRef.current);
        if (!cancelled) setReady(true);
      }

      void init().catch(() => {
        if (!cancelled) setMountError(unavailableMessage);
      });

      return () => {
        cancelled = true;
        payment?.unmount();
        paymentRef.current = null;
        elementsRef.current = null;
        stripeRef.current = null;
        setReady(false);
      };
    }, [publishableKey, locale, amount, unavailableMessage]);

    useEffect(() => {
      const elements = elementsRef.current;
      if (!elements || amount <= 0) return;
      void elements.update({ amount });
    }, [amount]);

    useImperativeHandle(ref, () => ({
      async submitElements() {
        const elements = elementsRef.current;
        if (!elements) return { error: unavailableMessage };
        const { error } = await elements.submit();
        if (error) return { error: error.message ?? unavailableMessage };
        return {};
      },
      async submitAndConfirm({ clientSecret, returnUrl, billingDetails }) {
        const stripe = stripeRef.current;
        const elements = elementsRef.current;
        if (!stripe || !elements) return { error: unavailableMessage };

        if (clientSecret.includes("_secret_mock")) {
          return {};
        }

        const { error } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: returnUrl,
            payment_method_data: {
              billing_details: billingDetails,
            },
          },
        });
        if (error) return { error: error.message ?? unavailableMessage };
        return {};
      },
    }));

    if (!publishableKey) {
      return (
        <p className="checkout-page__status" role="status">
          {unavailableMessage}
        </p>
      );
    }

    return (
      <div className="payment-checkout">
        {mountError ? (
          <p className="checkout-page__error" role="alert">
            {mountError}
          </p>
        ) : null}
        <div
          ref={mountRef}
          className="payment-checkout__element"
          data-ready={ready ? "true" : "false"}
        />
      </div>
    );
  },
);

export default PaymentCheckout;
