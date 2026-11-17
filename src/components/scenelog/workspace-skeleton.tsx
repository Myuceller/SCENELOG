import app from "./scenelog.module.css";
import hero from "./taste-hero.module.css";
import figure from "./glass-figure.module.css";
import styles from "./workspace-skeleton.module.css";

type View = "discover" | "diary" | "collection" | "themes" | "friends" | "print";
const headings = {
  diary: <>달력에 남은 <em>장면들.</em></>,
  collection: <>나의 영화 <em>컬렉션.</em></>,
  themes: <>좋아하는 데는 <em>이유가 있지.</em></>,
  friends: <>친구들</>,
  print: <>취향을 한 장에. <em>Print it.</em></>,
};

/** Reuse the real page geometry; only pending content is a placeholder. */
export function WorkspaceSkeleton({ view }: { view: View }) {
  return <main id="main" className={app.main} aria-busy="true">
    <p className="sr-only" role="status">기록을 불러오는 중입니다.</p>
    {view === "discover" ? <section className={hero.hero} aria-hidden="true">
      <div className={hero.title}>
        <p className={hero.eyebrow}><span className={styles.eyebrow} /></p>
        <h1><span className={styles.titleLine} /><br /><span className={styles.titleShort} /></h1>
      </div>
      <div className={figure.wrap}><div className={figure.stage + " " + styles.figure} /></div>
      <div className={hero.actions}>
        <span className={hero.primary + " " + styles.action} />
        <span className={hero.monthLink + " " + styles.month} />
      </div>
    </section> : <section className={app.pageSection}>
      <div className={app.pageHeading}><h1>{headings[view]}</h1></div>
      <div className={styles.pendingRows} aria-hidden="true"><span /><span /></div>
    </section>}
  </main>;
}
