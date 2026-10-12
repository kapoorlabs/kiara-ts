export const StoreState = {
  LOADING: "loading",
  PREPARING: "preparing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type StoreState = (typeof StoreState)[keyof typeof StoreState];
