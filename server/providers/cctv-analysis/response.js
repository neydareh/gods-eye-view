export function jsonResponse(status, payload, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  };
}
