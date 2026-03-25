export type WorkerMessage = {
  type: string;
  dbId?: string;
  args: Record<string, unknown>;
  messageId?: string;
  departureTime?: number;
};

export type Worker1Promiser = {
  (type: string, args: Record<string, unknown>): Promise<unknown>;
  (message: WorkerMessage): Promise<unknown>;
};

export type WorkerHandle = {
  start?: () => void;
  worker: Worker;
};

type WorkerMessageEvent = {
  type: string;
  dbId?: string;
  messageId?: string;
  result?: unknown;
};

type WorkerConfig = {
  worker?:
    | Worker
    | WorkerHandle
    | Promise<Worker | WorkerHandle>
    | (() => Worker | WorkerHandle | Promise<Worker | WorkerHandle>);
  onerror?: (...args: unknown[]) => void;
  onunhandled?: (event: MessageEvent<WorkerMessageEvent>) => void;
  generateMessageId?: (message: WorkerMessage) => string;
  debug?: (...args: unknown[]) => void;
};

type Handler = {
  onrow?: (event: WorkerMessageEvent) => void;
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
};

export async function sqlite3Worker1Promiser(
  config: WorkerConfig = {}
): Promise<Worker1Promiser> {
  const workerConfig = Object.assign(Object.create(null), config);
  const handlerMap: Record<string, Handler> = Object.create(null);
  const noop = () => {};
  const err = workerConfig.onerror ?? noop;
  const debug = workerConfig.debug ?? noop;
  const idTypeMap: Record<string, number> | undefined =
    workerConfig.generateMessageId ? undefined : Object.create(null);
  const genMessageId =
    workerConfig.generateMessageId ??
    ((message: WorkerMessage) => {
      if (!idTypeMap) {
        throw new Error("idTypeMap is not initialized");
      }

      return (
        message.type +
        "#" +
        (idTypeMap[message.type] = (idTypeMap[message.type] || 0) + 1)
      );
    });

  if (!workerConfig.worker) {
    throw new Error("sqlite3Worker1Promiser requires a worker");
  }

  const workerResult = await (typeof workerConfig.worker === "function"
    ? workerConfig.worker()
    : workerConfig.worker);
  const workerHandle =
    workerResult instanceof Worker ? { worker: workerResult } : workerResult;
  const worker = workerHandle.worker;
  let dbId: string | undefined;
  let workerFailure: Error | null = null;
  let resolveReady: ((value: Worker1Promiser) => void) | null = null;
  let rejectReady: ((reason?: unknown) => void) | null = null;

  const readyPromise = new Promise<Worker1Promiser>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  let isReady = false;
  let promiserFunc: Worker1Promiser;

  const getWorkerError = (event: ErrorEvent) => {
    if (event.error instanceof Error) {
      return event.error;
    }

    if (typeof event.message === "string" && event.message.length > 0) {
      return new Error(event.message);
    }

    return new Error("sqlite3 worker error");
  };

  const rejectPendingHandlers = (error: Error) => {
    for (const [messageId, handler] of Object.entries(handlerMap)) {
      delete handlerMap[messageId];
      handler.reject(error);
    }
  };

  worker.onerror = (event: ErrorEvent) => {
    workerFailure = getWorkerError(event);

    if (!isReady) {
      rejectReady?.(workerFailure);
    } else {
      rejectPendingHandlers(workerFailure);
    }

    err("sqlite3Worker1Promiser():", workerFailure);
  };

  worker.onmessage = (event: MessageEvent<WorkerMessageEvent>) => {
    const message = event.data;

    debug("worker1.onmessage", message);

    let handler = message.messageId ? handlerMap[message.messageId] : undefined;

    if (!handler) {
      if (
        message &&
        message.type === "sqlite3-api" &&
        message.result === "worker1-ready"
      ) {
        isReady = true;
        try {
          resolveReady?.(promiserFunc);
        } catch (error) {
          rejectReady?.(error);
        }
        return;
      }

      handler = handlerMap[message.type];
      if (handler?.onrow) {
        handler.onrow(message);
        return;
      }

      if (workerConfig.onunhandled) {
        workerConfig.onunhandled(event);
      } else {
        err("sqlite3Worker1Promiser() unhandled worker message:", message);
      }
      return;
    }

    if (message.messageId) {
      delete handlerMap[message.messageId];
    }

    switch (message.type) {
      case "error":
        handler.reject(message);
        return;
      case "open":
        if (!dbId) {
          dbId = message.dbId;
        }
        break;
      case "close":
        if (message.dbId === dbId) {
          dbId = undefined;
        }
        break;
      default:
        break;
    }

    try {
      handler.resolve(message);
    } catch (error) {
      handler.reject(error);
    }
  };

  promiserFunc = function promiser(
    typeOrMessage: string | WorkerMessage,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    if (workerFailure) {
      return Promise.reject(workerFailure);
    }

    let message: WorkerMessage;

    if (typeof typeOrMessage === "string") {
      if (args === undefined) {
        throw new Error(
          "Invalid arguments for sqlite3Worker1Promiser-created factory."
        );
      }

      message = {
        type: typeOrMessage,
        args,
        dbId: args.dbId as string | undefined,
      };
    } else {
      message = typeOrMessage;
    }

    if (!message.dbId && message.type !== "open") {
      message.dbId = dbId;
    }

    message.messageId = genMessageId(message);
    message.departureTime = performance.now();

    const proxy = Object.create(null) as Handler;
    let rowCallbackId: string | undefined;

    if (message.type === "exec" && message.args) {
      if (typeof message.args.callback === "function") {
        rowCallbackId = `${message.messageId}:row`;
        proxy.onrow = message.args.callback as (
          event: WorkerMessageEvent
        ) => void;
        message.args.callback = rowCallbackId;
        handlerMap[rowCallbackId] = proxy;
      } else if (typeof message.args.callback === "string") {
        throw new Error(
          "exec callback may not be a string when using the Promise interface."
        );
      }
    }

    let promise = new Promise<unknown>((resolve, reject) => {
      proxy.resolve = resolve;
      proxy.reject = reject;
      handlerMap[message.messageId as string] = proxy;
      debug(
        "Posting",
        message.type,
        `message to Worker dbId=${dbId || "default"}:`,
        message
      );
      worker.postMessage(message);
    });

    if (rowCallbackId) {
      promise = promise.finally(() => {
        delete handlerMap[rowCallbackId as string];
      });
    }

    return promise;
  };

  workerHandle.start?.();

  return readyPromise;
}
