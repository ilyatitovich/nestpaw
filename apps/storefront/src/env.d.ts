/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_STORE_URL: string;
  readonly PUBLIC_PLAUSIBLE_DOMAIN?: string;
  readonly PUBLIC_GA4_MEASUREMENT_ID?: string;
  readonly PUBLIC_ANALYTICS_PROVIDER?: string;
}

interface Window {
  __activateAnalyticsConsent?: () => void;
  turnstile?: {
    render: (
      element: HTMLElement | string,
      options: {
        sitekey: string;
        theme?: "light" | "dark" | "auto";
        size?: "normal" | "flexible" | "compact";
      },
    ) => string;
    reset: (widgetId?: string | HTMLElement) => void;
    remove: (widgetId: string) => void;
  };
}
