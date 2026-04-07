type QueryParams = Record<string, string | number | boolean | null | undefined>;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

function buildUrl(path: string, params?: QueryParams): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const baseUrl = API_BASE_URL.replace(/\/$/, "");

  let urlString: string;
  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    urlString = `${baseUrl}/${normalizedPath}`;
  } else {
    urlString = `${baseUrl}/${normalizedPath}`.replace(/\/\/+/g, "/");
  }

  if (params) {
    const url = baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
      ? new URL(urlString)
      : new URL(urlString, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  return urlString;
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

// Get CSRF token from cookies or fetch a new one
async function getCsrfToken(): Promise<string> {
  // Try to get from cookies first
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrftoken='));

  if (csrfCookie) {
    return csrfCookie.split('=')[1];
  }

  // Fetch new CSRF token
  const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
    credentials: 'include',
  });

  const data = await parseJsonResponse(response);
  if (!data?.success) {
    throw new Error('Failed to get CSRF token');
  }

  return data.data.csrfToken;
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    credentials: 'include',
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.error ?? body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Unwrap the response if it has success/data structure
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) {
      return body.data as T;
    } else {
      throw new Error(body.error || 'Request failed');
    }
  }

  return body as T;
}

export async function apiPost<T>(
  path: string,
  payload: unknown,
  params?: QueryParams,
): Promise<T> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(buildUrl(path, params), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      "Referer": window.location.origin,
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.error ?? body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Unwrap the response if it has success/data structure
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) {
      return body.data as T;
    } else {
      throw new Error(body.error || 'Request failed');
    }
  }

  return body as T;
}

export async function apiPatch<T>(
  path: string,
  payload: unknown,
  params?: QueryParams,
): Promise<T> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(buildUrl(path, params), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      "Referer": window.location.origin,
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.error ?? body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Unwrap the response if it has success/data structure
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) {
      return body.data as T;
    } else {
      throw new Error(body.error || 'Request failed');
    }
  }

  return body as T;
}

export async function apiPut<T>(
  path: string,
  payload: unknown,
  params?: QueryParams,
): Promise<T> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(buildUrl(path, params), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      "Referer": window.location.origin,
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.error ?? body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Unwrap the response if it has success/data structure
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) {
      return body.data as T;
    } else {
      throw new Error(body.error || 'Request failed');
    }
  }

  return body as T;
}

export async function apiDelete<T>(path: string, params?: QueryParams): Promise<T> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(buildUrl(path, params), {
    method: "DELETE",
    headers: {
      "X-CSRFToken": csrfToken,
      "Referer": window.location.origin,
    },
    credentials: 'include',
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const message = body?.error ?? body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Unwrap the response if it has success/data structure
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    if (body.success) {
      return body.data as T;
    } else {
      throw new Error(body.error || 'Request failed');
    }
  }

  return body as T;
}
