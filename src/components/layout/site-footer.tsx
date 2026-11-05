import styles from "./site-layout.module.css";

export function SiteFooter() {
  return (
    <footer className={`container ${styles.footer}`}>
      <div><strong>SCENELOG.</strong><p>영화가 끝나도, 우리의 이야기는 계속되니까.</p></div>
      <small>Made by guma &amp; gamja · 영화와 평점은 샘플 데이터입니다.</small>
    </footer>
  );
}
