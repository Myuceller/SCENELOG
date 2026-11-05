import styles from "./site-layout.module.css";

export function SiteFooter() {
  return (
    <footer className={`container ${styles.footer}`}>
      <div><strong>SCENELOG.</strong><p>영화가 끝나도, 우리의 이야기는 계속되니까.</p></div>
      <small>
        Made by guma &amp; gamja · 영화 정보: <a href="https://www.themoviedb.org/">TMDB</a><br />
        TMDB 평점을 5점 만점으로 환산해 표시합니다.<br />
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </small>
    </footer>
  );
}
