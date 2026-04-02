type QueryParams = Record<string, string | number | boolean | null | undefined>;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

function buildUrl(path: string, params?: QueryParams): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${API_BASE_URL}/${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const response = await fetch(buildUrl(path, params));
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export async function apiPatch<T>(
  path: string,
  payload: unknown,
  params?: QueryParams,
): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}
