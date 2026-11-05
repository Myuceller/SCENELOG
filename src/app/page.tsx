import { ArrowUpRight } from "lucide-react";
import { MovieList } from "@/components/home/movie-list";
import { movies } from "@/data/movies";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main id="main" className="container">
      <section className={styles.intro} aria-labelledby="intro-title">
        <div>
          <p className={styles.eyebrow}>EVERY SCENE HAS A STORY.</p>
          <h1 id="intro-title">영화를 보고,<br /><span>나를 기록하다.</span></h1>
          <p className={styles.description}>좋았던 장면, 오래 남은 대사, 조금은 다른 생각.<br />당신의 시선으로 완성되는 영화 이야기.</p>
          <a href="#movies" className={styles.link}>나의 다음 영화 발견하기 <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
        <div className={styles.note}>
          <span className={styles.noteLabel}>A NOTE FROM SCENELOG</span>
          <p>“같은 영화를 봐도,<br />우리는 다른 장면을 기억한다.”</p>
          <span className={styles.noteFooter}>당신의 0.1점에는 어떤 이야기가 있나요?</span>
          <span className={styles.asterisk} aria-hidden="true">✳</span>
        </div>
      </section>
      <MovieList movies={movies} />
    </main>
  );
}
