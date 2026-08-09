/**
 * Server-Side Request Forgery (SSRF) Protection
 * Rejects requests targeting internal/loopback IP ranges and cloud metadata services.
 */
export function checkSSRFProtection(urlStr: string): void {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    const blockedHostnames = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254", // AWS/GCP/Azure Cloud Metadata API
    ];

    if (
      blockedHostnames.includes(hostname) ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.31.")
    ) {
      throw new Error(`SSRF Blocked: Cannot make requests to internal/private network address (${hostname}).`);
    }
  } catch (err: any) {
    if (err.message?.startsWith("SSRF Blocked")) throw err;
    throw new Error(`Invalid URL provided for HTTP Request step.`);
  }
}
