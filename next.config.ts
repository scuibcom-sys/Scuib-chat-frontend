import type { NextConfig } from "next";

type RemoteImagePattern = Exclude<
  NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number],
  URL
>;

function buildRemoteImagePattern(urlValue: string | undefined): RemoteImagePattern | null {
  if (!urlValue) return null;

  try {
    const parsedUrl = new URL(urlValue);
    const protocol: RemoteImagePattern["protocol"] =
      parsedUrl.protocol === "http:" ? "http" : "https";

    return {
      protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      buildRemoteImagePattern(process.env.NEXT_PUBLIC_API_BASE_URL),
      buildRemoteImagePattern(process.env.NEXT_PUBLIC_APP_URL),
    ].filter((pattern): pattern is NonNullable<ReturnType<typeof buildRemoteImagePattern>> =>
      Boolean(pattern),
    ),
  },
};

export default nextConfig;
