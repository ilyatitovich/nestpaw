import { defineMiddleware } from "astro:middleware";

/** Old English URLs lived under /en. The default locale is now unprefixed. */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const stripped = pathname.slice(3) || "/";
    return context.redirect(`${stripped}${search}`);
  }
  return next();
});
