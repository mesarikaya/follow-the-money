/**
 * The backend API, one module per domain. Import from `@/lib/api` — this barrel re-exports
 * everything, so callers never need to know which module a type or fetcher lives in.
 */

export * from "./categories";
export * from "./macro";
export * from "./rotation";
export * from "./portfolio";
export * from "./backtest";
export * from "./alerts";
export * from "./themes";
export * from "./admin";
