type InvokeFn = <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;

const fallbackInvoke: InvokeFn = async () => {
  throw new Error("Tauri invoke unavailable");
};

export const invokeTauri: InvokeFn =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? ((command, payload) =>
        (window as unknown as { __TAURI_INTERNALS__: { invoke: InvokeFn } }).__TAURI_INTERNALS__.invoke(
          command,
          payload
        ))
    : fallbackInvoke;
