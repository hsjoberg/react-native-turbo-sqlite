/// <reference lib="dom" />

import type { WorkerHandle } from "./sqlite3Worker1Promiser";
import proxyWorkerBase64 from "../vendor/sqlite-wasm/sqlite3-opfs-async-proxy-base64";
import wasmBase64 from "../vendor/sqlite-wasm/sqlite3-wasm-base64";
import workerRuntimeBase64 from "../vendor/sqlite-wasm/sqlite3-worker1-base64";

let proxyWorkerUrlPromise: Promise<string> | null = null;
let outerWorkerUrlPromise: Promise<string> | null = null;

const blobWorkerBootstrap = `
function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
}

function decodeBase64Text(base64) {
  return atob(base64);
}

self.addEventListener("message", function onMessage(event) {
  if (event.data?.type !== "__rnturbosqlite_init") {
    return;
  }

  self.removeEventListener("message", onMessage);
  const wasmBinary = decodeBase64(event.data.wasmBase64);
  const wasmUrl = URL.createObjectURL(
    new Blob([toArrayBuffer(wasmBinary)], {
      type: "application/wasm",
    })
  );
  self.__RNTurboSqliteWorkerModule = {
    wasmBinary,
    proxyUri: event.data.proxyUri,
    locateFile(path) {
      return path === "sqlite3.wasm" ? wasmUrl : path;
    },
  };

  const workerRuntimeUrl = URL.createObjectURL(
    new Blob([decodeBase64Text(event.data.workerRuntimeBase64)], {
      type: "application/javascript",
    })
  );

  importScripts(workerRuntimeUrl);
});
`;

function decodeBase64Text(base64: string): string {
  return atob(base64);
}

async function getProxyWorkerUrl(): Promise<string> {
  proxyWorkerUrlPromise ??= Promise.resolve(
    URL.createObjectURL(
      new Blob([decodeBase64Text(proxyWorkerBase64)], {
        type: "application/javascript",
      })
    )
  );

  return proxyWorkerUrlPromise;
}

async function getOuterWorkerUrl(): Promise<string> {
  outerWorkerUrlPromise ??= Promise.resolve(
    URL.createObjectURL(
      new Blob([blobWorkerBootstrap], {
        type: "application/javascript",
      })
    )
  );

  return outerWorkerUrlPromise;
}

export async function createBlobSqliteWorker(): Promise<WorkerHandle> {
  const [proxyUri, workerUrl] = [
    await getProxyWorkerUrl(),
    await getOuterWorkerUrl(),
  ];
  const worker = new Worker(workerUrl);

  return {
    start() {
      worker.postMessage({
        type: "__rnturbosqlite_init",
        proxyUri,
        wasmBase64,
        workerRuntimeBase64,
      });
    },
    worker,
  };
}
