import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SCENELOG — 영화를 보고, 나를 기록하다", template: "%s | SCENELOG" },
  description: "장면의 여운부터 나만의 평론까지. 영화에 대한 취향과 생각을 기록하는 공간, SCENELOG.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <a href="#main" className="skip-link">본문 바로가기</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
