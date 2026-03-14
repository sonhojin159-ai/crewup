import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "크루업 - 함께하는 부업 플랫폼",
  description:
    "부업 크루를 만들고 참여하세요. 함께하면 더 쉬운 부업, 크루업에서 시작하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/*
          Pretendard Variable — best Korean UI font.
          Loaded from CDN (jsDelivr mirrors the GitHub release).
          For production, self-host via public/fonts/ and use next/font/local
          to get the automatic preload and display:swap behaviour.
        */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
