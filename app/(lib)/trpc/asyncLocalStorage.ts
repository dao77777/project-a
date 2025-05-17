import { AsyncLocalStorage } from "async_hooks";

export const asyncLocalStorage = new AsyncLocalStorage<{ requestId: string }>();

export const getRequestId = () => asyncLocalStorage.getStore()!.requestId;
