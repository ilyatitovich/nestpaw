import { Injectable, Logger } from "@nestjs/common";

type SiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  async verify(token: string, remoteip?: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      this.logger.warn("TURNSTILE_SECRET_KEY missing — rejecting token");
      return false;
    }
    if (!token || token.length > 2048) return false;

    try {
      const body = new URLSearchParams();
      body.set("secret", secret);
      body.set("response", token);
      if (remoteip) body.set("remoteip", remoteip);

      const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
      );
      const data = (await res.json()) as SiteverifyResponse;
      return Boolean(data.success);
    } catch (e) {
      this.logger.error("Turnstile siteverify failed", e);
      return false;
    }
  }
}
