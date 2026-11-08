import { type RefObject, useEffect, useRef } from "react";
import {
  ensureTurnstileScript,
  readTurnstileToken,
} from "@/lib/customer-account";

export type TurnstileApi = {
  getToken: () => string;
  reset: () => void;
};

type Props = {
  siteKey: string;
  apiRef: RefObject<TurnstileApi | null>;
};

/** Client-only Turnstile host — avoids SSR/hydration mismatch from auto-injected widgets. */
export default function TurnstileWidget({ siteKey, apiRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    let timer = 0;

    ensureTurnstileScript();

    const attach = () => {
      if (cancelled || !hostRef.current || !window.turnstile) return false;
      hostRef.current.replaceChildren();
      widgetId = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
      });
      apiRef.current = {
        getToken: () => readTurnstileToken(hostRef.current),
        reset: () => {
          if (widgetId != null) window.turnstile?.reset(widgetId);
        },
      };
      return true;
    };

    if (!attach()) {
      timer = window.setInterval(() => {
        if (attach()) window.clearInterval(timer);
      }, 50);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      apiRef.current = null;
      if (widgetId != null) window.turnstile?.remove(widgetId);
    };
  }, [apiRef, siteKey]);

  return <div ref={hostRef} className="account-turnstile" />;
}
