export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
  getCartToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
};

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(
    path: string,
    init: RequestInit & { auth?: boolean; cart?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    if (init.auth !== false) {
      const token = options.getAccessToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    if (init.cart !== false) {
      const cartToken = options.getCartToken?.();
      if (cartToken) headers.set("X-Cart-Token", cartToken);
    }

    const res = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      options.onUnauthorized?.();
    }

    if (!res.ok) {
      let message = res.statusText;
      let code: string | undefined;
      try {
        const body = (await res.json()) as {
          message?: string | string[];
          code?: string;
        };
        message = Array.isArray(body.message)
          ? body.message.join(", ")
          : (body.message ?? message);
        code = body.code;
      } catch {
        // ignore parse errors
      }
      throw new ApiClientError(res.status, message, code);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,
    get: <T>(path: string, init?: RequestInit) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "PATCH",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "PUT",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    delete: <T>(path: string, init?: RequestInit) =>
      request<T>(path, { ...init, method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
