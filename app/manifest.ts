import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scuib Chat",
    short_name: "Scuib Chat",
    description: "Chat with the gifted ones",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F3ED",
    theme_color: "#4F3422",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
