let accessToken: string | null = null;

export function getCustomerAccessToken() {
  return accessToken;
}

export function setCustomerAccessToken(token: string | null) {
  accessToken = token;
}
