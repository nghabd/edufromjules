const defaultCloudflareHosts = [
  "cloudflarestream.com",
  "videodelivery.net",
  "r2.dev",
  "r2.cloudflarestorage.com",
];

export function isAllowedCloudflareMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["https:"].includes(url.protocol)) return false;
    const allowedHosts = (process.env.CLOUDFLARE_MEDIA_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const hosts = [...allowedHosts, ...defaultCloudflareHosts];
    return hosts.some((host) => url.hostname.toLowerCase() === host || url.hostname.toLowerCase().endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function inferMaterialType(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".pdf")) return "PDF";
  return "VIDEO";
}
