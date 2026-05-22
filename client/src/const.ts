export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = () => {
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/api/auth/login?redirect=${encodeURIComponent(redirect || "/")}`;
};
