import type { NextConfig } from "next";

// Derive Supabase hostname for remote image optimization, if configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let imagesConfig: NextConfig["images"] | undefined = undefined;
try {
  if (supabaseUrl) {
    const { hostname, protocol } = new URL(supabaseUrl);
    const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
      {
        protocol: (protocol?.replace(":", "") as "http" | "https") || "https",
        hostname,
      },
    ];

    const extraDomains = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const d of extraDomains) {
      try {
        // Allow raw hostname or full URL
        if (d.includes("http://") || d.includes("https://")) {
          const u = new URL(d);
          patterns.push({
            protocol: (u.protocol.replace(":", "") as "http" | "https") || "https",
            hostname: u.hostname,
          });
        } else {
          patterns.push({ protocol: "https", hostname: d });
        }
      } catch {}
    }

    imagesConfig = { remotePatterns: patterns };
  }
} catch {
  // ignore invalid URL; keep default image config
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: imagesConfig,
  compiler: {
    // Remove console.* in production bundles except errors
    removeConsole: {
      exclude: ["error"],
    },
  },
};

export default nextConfig;
