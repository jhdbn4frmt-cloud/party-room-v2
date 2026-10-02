import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Party Room 聚會遊戲",
    short_name: "Party Room",
    description: "一個房間，玩一整晚",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3e9",
    theme_color: "#7155e8",
    lang: "zh-TW",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
