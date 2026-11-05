import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container" style={{ paddingBlock: 100, textAlign: "center" }}>
      <p>404</p>
      <h1>아직 기록되지 않은 장면이에요.</h1>
      <p>요청한 페이지를 찾을 수 없습니다.</p>
      <Link href="/" style={{ textDecoration: "underline" }}>메인 페이지로 돌아가기</Link>
    </main>
  );
}
