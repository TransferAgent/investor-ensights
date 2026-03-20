export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") return false;
    if (hostname === "0.0.0.0" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) return false;
    if (hostname === "metadata.google.internal") return false;
    return true;
  } catch {
    return false;
  }
}

export async function validateImageUrl(url: string): Promise<{ reachable: boolean; width?: number; height?: number; error?: string }> {
  if (!isSafeUrl(url)) {
    return { reachable: false, error: "URL must be HTTPS and not target internal/private networks" };
  }

  try {
    let response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
    }
    if (!response.ok) {
      return { reachable: false, error: `Image URL returned HTTP ${response.status}` };
    }
    return { reachable: true };
  } catch {
    return { reachable: false, error: "Image URL is unreachable or timed out" };
  }
}
