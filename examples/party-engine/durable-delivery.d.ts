export function deliver(effect: () => void): void;
export function withDeferredDelivery<T>(operation: () => T | Promise<T>, commit: () => Promise<void>): Promise<T>;
