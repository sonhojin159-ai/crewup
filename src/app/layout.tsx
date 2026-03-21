import type { Metadata } from "next";
import "./globals.css";

const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

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
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href={PRETENDARD_CSS}
        />
        <link
          rel="stylesheet"
          href={PRETENDARD_CSS}
          media="print"
        />
        <noscript>
          <link rel="stylesheet" href={PRETENDARD_CSS} />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelector('link[media="print"][rel="stylesheet"]').addEventListener('load',function(){this.media='all'})`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
