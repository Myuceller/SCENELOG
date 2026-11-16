import Link from "next/link";
import { Clapperboard } from "lucide-react";
import styles from "./site-layout.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.logo} aria-label="SCENELOG 홈">
          <Clapperboard size={25} aria-hidden="true" />
          SCENELOG<span>.</span>
        </Link>
        <nav aria-label="주 메뉴">
          <a href="#movies" className={styles.navLink}>영화 둘러보기</a>
        </nav>
      </div>
    </header>
  );
}
