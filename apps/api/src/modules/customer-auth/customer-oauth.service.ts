import {
  createHash,
  createPrivateKey,
  createSign,
  randomBytes,
} from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { normalizeEmail, oauthRedirectUri } from "./customer-auth.util.js";

export type OAuthProvider = "google" | "apple";

type OAuthProfile = {
  provider: OAuthProvider;
  subject: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
};

@Injectable()
export class CustomerOAuthService {
  constructor(private prisma: PrismaService) {}

  isConfigured(provider: OAuthProvider): boolean {
    if (provider === "google") {
      return Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      );
    }
    return Boolean(
      process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY,
    );
  }

  buildAuthorizationUrl(
    provider: OAuthProvider,
    state: string,
    codeVerifier: string,
  ): string {
    if (!this.isConfigured(provider)) {
      throw new ServiceUnavailableException(
        `${provider} OAuth is not configured`,
      );
    }
    const redirectUri = oauthRedirectUri(provider);
    const challenge = base64Url(createHashSha256(codeVerifier));

    if (provider === "google") {
      const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "online",
        prompt: "select_account",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    const params = new URLSearchParams({
      client_id: requireEnv("APPLE_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: "name email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `https://appleid.apple.com/auth/authorize?${params}`;
  }

  async exchangeCode(
    provider: OAuthProvider,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthProfile> {
    if (provider === "google") return this.exchangeGoogle(code, codeVerifier);
    return this.exchangeApple(code, codeVerifier);
  }

  async resolveCustomer(profile: OAuthProfile) {
    const emailNormalized = normalizeEmail(profile.email);
    const existingIdentity = await this.prisma.customerIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: profile.provider,
          providerSubject: profile.subject,
        },
      },
      include: { customer: true },
    });
    if (existingIdentity) {
      return existingIdentity.customer;
    }

    const byEmail = await this.prisma.customer.findUnique({
      where: { emailNormalized },
    });

    if (byEmail) {
      if (!byEmail.emailVerifiedAt && !profile.emailVerified) {
        throw new UnauthorizedException(
          "Email conflict — sign in with email OTP to link this account",
        );
      }
      await this.prisma.customerIdentity.create({
        data: {
          provider: profile.provider,
          providerSubject: profile.subject,
          customerId: byEmail.id,
        },
      });
      if (!byEmail.emailVerifiedAt && profile.emailVerified) {
        return this.prisma.customer.update({
          where: { id: byEmail.id },
          data: {
            emailVerifiedAt: new Date(),
            firstName: byEmail.firstName ?? profile.firstName,
            lastName: byEmail.lastName ?? profile.lastName,
          },
        });
      }
      return byEmail;
    }

    return this.prisma.customer.create({
      data: {
        email: profile.email.trim(),
        emailNormalized,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        identities: {
          create: {
            provider: profile.provider,
            providerSubject: profile.subject,
          },
        },
      },
    });
  }

  private async exchangeGoogle(code: string, codeVerifier: string) {
    const redirectUri = oauthRedirectUri("google");
    const body = new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException("Google token exchange failed");
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new UnauthorizedException("Google token exchange failed");
    }
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!profileRes.ok) {
      throw new UnauthorizedException("Google profile fetch failed");
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
    };
    if (!profile.sub || !profile.email) {
      throw new BadRequestException("Google account missing email");
    }
    return {
      provider: "google" as const,
      subject: profile.sub,
      email: profile.email,
      emailVerified: Boolean(profile.email_verified),
      firstName: profile.given_name,
      lastName: profile.family_name,
    };
  }

  private async exchangeApple(code: string, codeVerifier: string) {
    const redirectUri = oauthRedirectUri("apple");
    const clientSecret = createAppleClientSecret();
    const body = new URLSearchParams({
      code,
      client_id: requireEnv("APPLE_CLIENT_ID"),
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException("Apple token exchange failed");
    }
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException("Apple token exchange failed");
    }
    const payload = decodeJwtPayload(tokens.id_token) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
    };
    if (!payload.sub) {
      throw new UnauthorizedException("Apple token missing subject");
    }
    const email = payload.email;
    if (!email) {
      throw new BadRequestException(
        "Apple did not return an email — use email OTP or re-authorize with email scope",
      );
    }
    return {
      provider: "apple" as const,
      subject: payload.sub,
      email,
      emailVerified:
        payload.email_verified === true || payload.email_verified === "true",
    };
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ServiceUnavailableException(`${name} is not configured`);
  }
  return value;
}

function createHashSha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (!payloadPart) throw new UnauthorizedException("Invalid id_token");
  const json = Buffer.from(
    payloadPart.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function createAppleClientSecret(): string {
  const teamId = requireEnv("APPLE_TEAM_ID");
  const clientId = requireEnv("APPLE_CLIENT_ID");
  const keyId = requireEnv("APPLE_KEY_ID");
  let privateKey = requireEnv("APPLE_PRIVATE_KEY");
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(
    Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })),
  );
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        iss: teamId,
        iat: now,
        exp: now + 60 * 50,
        aud: "https://appleid.apple.com",
        sub: clientId,
      }),
    ),
  );
  const data = `${header}.${payload}`;
  const key = createPrivateKey(privateKey);
  const sign = createSign("SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${data}.${base64Url(sig)}`;
}

export function newOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function newCodeVerifier(): string {
  return base64Url(randomBytes(32));
}
