import { getRequestId } from "./asyncLocalStorage";

type ContextItem = {
  requestId: string;
  userAgent: string;
  ipAddress: string;
  type: string;
  path: string;
  input: any;
  step: number;
}

type PartialProps = "type" | "path" | "input" | "step";

type PendingContextItem = Omit<ContextItem, PartialProps>;

type MultualContextItem = Pick<ContextItem, PartialProps>;

class ContextList {
  list: ContextItem[];
  pendingList: PendingContextItem[];

  constructor() {
    this.list = [];
    this.pendingList = [];
  }

  addPending(ctx: PendingContextItem) {
    this.pendingList.push(ctx);
  }
    
  removePending(requestId: string) {
    this.pendingList = this.pendingList.filter(i => i.requestId !== requestId);
  }

  get(requestId: string) {
    const item = this.list.find(i => i.requestId === requestId);

    return item;
  }

  add(requestId: string, ctx: MultualContextItem) { 
    const item = this.pendingList.find(i => i.requestId === requestId);

    if (item) {
      this.list.push({
        ...item,
        ...ctx
      });

      this.pendingList = this.pendingList.filter(i => i.requestId !== requestId);
    }
  }

  remove(requestId: string) {
    this.list = this.list.filter(i => i.requestId !== requestId);
  }
}

let contextList: ContextList | null = null;

export const getContextList = () => {
  if (!contextList) {
    contextList = new ContextList();
  }

  return contextList;
}

export const getContext = () => {
  const context = getContextList().get(getRequestId());

  return context!;
}