import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Party Room｜一個房間，玩一整晚",
  description:
    "給朋友聚會的遊戲小宇宙。加入一次，默契、音樂、知識、推理一路玩下去。",
  applicationName: "Party Room",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Party Room",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3e9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
