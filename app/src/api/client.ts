export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public details: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export function apiUrl(value: string | undefined) {
  if (!value || !/^https?:\/\//.test(value))
    throw new ApiError(
      "Set EXPO_PUBLIC_API_URL to your computer LAN address or HTTPS backend, ending in /api.",
      0,
      "CONFIGURATION",
    );
  return value.replace(/\/+$/, "");
}
let token: string | null = null;
let expired: () => void = () => {};
export const setSessionToken = (value: string | null) => {
  token = value;
};
export const onExpired = (callback: () => void) => {
  expired = callback;
};
export function query(values: Record<string, unknown>) {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return entries.length
    ? "?" +
        entries
          .map(
            ([k, v]) =>
              `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`,
          )
          .join("&")
    : "";
}
export async function request<T = any>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    binary?: boolean;
    public?: boolean;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const sessionAtStart = token;
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.binary ? 60000 : 20000);
  try {
    const response = await fetch(
      apiUrl(process.env.EXPO_PUBLIC_API_URL) + path,
      {
        method: options.method ?? "GET",
        signal: controller.signal,
        headers: {
          Accept: options.binary ? "application/pdf" : "application/json",
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(!options.public && token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (
        response.status === 401 &&
        !options.public &&
        sessionAtStart === token
      )
        expired();
      throw new ApiError(
        error.message ?? `Request failed (${response.status}).`,
        response.status,
        error.code ?? "API_ERROR",
        error.details ?? [],
      );
    }
    if (response.status === 204) return undefined as T;
    if (options.binary) {
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new ApiError(
          "The server did not return a PDF.",
          502,
          "INVALID_PDF",
        );
      return (await response.arrayBuffer()) as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted)
      throw new ApiError("Request cancelled.", 0, "CANCELLED");
    throw new ApiError(
      controller.signal.aborted
        ? "The request timed out. Refresh to check its status before retrying."
        : "Cannot reach WildGuard. Check Wi-Fi and the backend address.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const mutate = (path: string, body?: unknown, method = "POST") =>
  request(path, { method, body });
export const safeRetry = (count: number, error: Error) =>
  count < 2 &&
  error instanceof ApiError &&
  ((error.status === 0 && error.code === "NETWORK_ERROR") ||
    error.status >= 500);
