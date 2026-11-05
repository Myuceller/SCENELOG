"use client";

import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Printer, Volume2 } from "lucide-react";
import type { ArchiveMovie as Movie } from "@/lib/archive-movies";
import { themes, type FilmLog, type ThemeKey } from "@/lib/scene-store";
import { exportPrintSheet, getPrintItems } from "@/lib/print-sheet";
import { Empty } from "./ui";
import styles from "./scenelog.module.css";

export function PrintRoom({ movies, logs, user, notify }: { movies: Movie[]; logs: FilmLog[]; user: string; notify: (message: string) => void }) {
  const [mode, setMode] = useState<"rating" | "tier">("rating");
  const [theme, setTheme] = useState<ThemeKey | "overall">("overall");
  const [title, setTitle] = useState("MY SCENE COLLECTION");
  const [status, setStatus] = useState<"idle" | "printing" | "done">("idle");
  const [sound, setSound] = useState(true);
  const [saving, setSaving] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = getPrintItems(movies, logs, theme, mode);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void audio.current?.close(); }, []);
  function print() {
    if (!items.length || status === "printing") return;
    if (sound) { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Printing works even without audio support. */ } }
    setStatus("printing");
    timer.current = setTimeout(() => {
      setStatus("done");
      if (sound && audio.current) {
        const ctx = audio.current; const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
        oscillator.type = "sine"; oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime); oscillator.frequency.setValueAtTime(1568, ctx.currentTime + .12);
        gain.gain.setValueAtTime(.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .7);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .7);
      }
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : 2900);
  }
  return <section className={styles.pageSection}>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>06 / THE PRINT ROOM</p><h1>취향을 한 장에. <em>Print it.</em></h1><p>모아둔 장면을 꺼내어, 나만의 영화 포스터로.</p></div><span className={styles.printEdition}>SCENELOG<br /><strong>PRESS™</strong></span></div>
    <div className={styles.printLayout}><aside className={styles.printSettings}><span className={styles.eyebrow}>PRINT OPTIONS</span><label>프린트 제목<input aria-label="프린트 제목" value={title} maxLength={36} onChange={e => { setTitle(e.target.value); setStatus("idle"); }} disabled={status === "printing"} /></label><div className={styles.fieldLabel}>어떻게 모아볼까요?</div><div className={styles.segmented}><button className={mode === "rating" ? styles.selectedSegment : ""} disabled={status === "printing"} onClick={() => { setMode("rating"); setStatus("idle"); }}>별점순</button><button className={mode === "tier" ? styles.selectedSegment : ""} disabled={status === "printing"} onClick={() => { setMode("tier"); setTheme("overall"); setStatus("idle"); }}>티어별</button></div><label>평가 기준<select aria-label="프린트 평가 기준" value={theme} disabled={status === "printing" || mode === "tier"} onChange={e => { setTheme(e.target.value as ThemeKey | "overall"); setStatus("idle"); }}><option value="overall">전체 별점</option>{themes.map(t => <option value={t.key} key={t.key}>{t.label}</option>)}</select></label><p className={styles.helper}>{mode === "tier" ? "직접 정한 티어를 우선해요. 지정하지 않으면 S 4.5↑ · A 4.0↑ · B 3.0↑ · C 2.0↑ · D 2.0 미만으로 모아요." : "평가를 남긴 영화가 높은 점수부터 한 장에 담겨요."}</p><label className={styles.checkLabel}><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /><Volume2 size={16} />출력 완료 소리</label><div className={styles.printSummary}><span>선택한 영화</span><strong>{items.length} FILMS</strong></div><button className={styles.redButton} disabled={!items.length || status === "printing"} onClick={print}><Printer size={18} />{status === "printing" ? "장면을 인쇄하고 있어요…" : status === "done" ? "한 번 더 프린트" : "프린트 시작"}</button><button className={styles.outlineButton} disabled={status !== "done" || saving} onClick={async () => { setSaving(true); try { await exportPrintSheet(items, title || "MY SCENE COLLECTION", user, mode); notify("포스터가 담긴 PNG 한 장을 저장했어요."); } catch (e) { notify(e instanceof Error ? e.message : "저장에 실패했어요. 다시 시도해 주세요."); } finally { setSaving(false); } }}><Download size={17} />{saving ? "이미지 만드는 중…" : "한 장의 PNG로 저장"}</button></aside>
      <div className={styles.printStage}><span className={styles.machineCaption}>SCENELOG PERSONAL PRINTER / MODEL 001</span><div className={styles.printer}><div className={styles.printerFeeder}><div /></div><div className={styles.printerTop}><strong>SceneLog<span>®</span></strong><div className={styles.printerDisplay}><i className={status === "printing" ? styles.blink : ""} />{status === "printing" ? "PRINTING..." : status === "done" ? "PRINT COMPLETE" : "READY TO PRINT"}</div></div><div className={styles.printerVents} /><div className={styles.printerFront}><span>SL—001</span><div><i /><i /><b /></div></div><div className={styles.printerSlot} /></div>
        {items.length ? <div className={`${styles.paperWindow} ${status === "printing" ? styles.printing : ""} ${status === "idle" ? styles.paperIdle : ""}`}><div className={styles.printPaper}><div className={styles.sheetBrand}>SceneLog.<span>PERSONAL<br />FILM ARCHIVE</span></div><h2>{title || "MY SCENE COLLECTION"}</h2><div className={styles.sheetMeta}>{user.toUpperCase()} / {items.length} FILMS / {mode === "tier" ? "TIER EDITION" : "RATING EDITION"}</div>{items.map((item, i) => <div className={styles.printRow} key={item.movie.id}><b>{mode === "tier" ? item.tier : String(i + 1).padStart(2, "0")}</b><Image width={300} height={450} sizes="(max-width: 640px) 45vw, 240px" src={item.movie.poster} alt={`${item.movie.title} 포스터`} /><span><strong>{item.movie.title}</strong><small>{item.movie.year ?? "개봉일 미정"} / {item.log.watchedOn || "관람일 미정"}</small></span><em>{item.score?.toFixed(1) ?? "—"}</em></div>)}<div className={styles.sheetFooter}>COLLECT SCENES.<br />KEEP YOUR POINT OF VIEW.<span className={styles.barcode} /></div></div></div> : <Empty title="인쇄할 영화가 없어요">먼저 이 기준으로 별점을 남겨주세요.</Empty>}
        <p className={styles.printStatus} role="status">{status === "done" ? <><Check size={16} />출력 완료. 당신의 취향을 저장해 보세요.</> : status === "printing" ? "잠시만요, 장면이 나오고 있어요." : "옵션을 고르고 프린트 버튼을 눌러보세요."}</p>
      </div>
    </div>
  </section>;
}
