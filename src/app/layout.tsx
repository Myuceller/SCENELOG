import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SceneLog — A life in scenes.", template: "%s | SceneLog" },
  description: "0.1점에 담긴 취향. 영화 기록, 포스터 달력, 친구의 추천과 나만의 영화 아카이브.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a href="#main" className="skip-link">본문 바로가기</a>{children}</body></html>;
}
