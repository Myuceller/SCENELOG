"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, X } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import type { FilmLog } from "@/lib/scene-model";
import type { FilmJournal } from "@/lib/journal-model";
import type { JournalVideoRatio } from "@/lib/journal-video";
import styles from "./film-journal.module.css";

export function JournalExport({ book, movies, logs, onBusy }: { book: FilmJournal; movies: ArchiveMovie[]; logs: FilmLog[]; onBusy: (busy: boolean) => void }) {
  const [ratio, setRatio] = useState<JournalVideoRatio>("square");
  const [progress, setProgress] = useState<number | null>(null), [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const controller = useRef<AbortController | null>(null), resultUrl = useRef<string | null>(null);
  useEffect(() => () => { controller.current?.abort(); if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); }, []);
  async function generate() {
    setError(""); setProgress(0); onBusy(true);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    setResult(null);
    const request = new AbortController(); controller.current = request;
    try {
      const { makeJournalVideo } = await import("@/lib/journal-video");
      const blob = await makeJournalVideo(book, movies, logs, ratio, request.signal, setProgress);
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(blob); resultUrl.current = url; setResult({ url, size: blob.size });
    } catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : "영상을 만들지 못했어요. 다시 시도해 주세요."); }
    finally { setProgress(null); onBusy(false); }
  }
  return <div className={styles.exportPanel}>
    <span className={styles.panelEyebrow}>YOUR JOURNAL, IN MOTION</span><h3>책장을 넘겨, 영상으로.</h3><p>꾸민 페이지를 표지부터 차례로 넘겨요. 빈 펼침면은 건너뛰고, 우표와 글자는 배치한 그대로 담아요.</p>
    <label>영상 비율<select aria-label="다이어리 영상 비율" value={ratio} disabled={progress !== null} onChange={event => { setRatio(event.target.value as JournalVideoRatio); if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); resultUrl.current = null; setResult(null); }}><option value="square">정사각형 · 1:1</option><option value="vertical">릴스 / 스토리 · 9:16</option></select></label>
    <p className={styles.exportNote}>MP4 · 1080px · 소리 없는 영상<br />파일을 저장한 뒤 원하는 곳에 올려주세요.</p>
    {progress === null ? <button className={styles.darkButton} disabled={!book.pages.some(page => page.items.length)} onClick={generate}><Film size={15} />{result ? "영상 다시 만들기" : "책장 넘김 영상 만들기"}</button> : <div role="status"><progress max="100" value={progress} /><p>영상을 만들고 있어요 · {progress}%</p><button className={styles.lightButton} onClick={() => controller.current?.abort()}><X size={13} />취소</button></div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {result && <div className={styles.videoResult}><video controls playsInline src={result.url} aria-label="다이어리 책장 넘김 영상 미리보기" /><a className={styles.darkButton} href={result.url} download={`SceneLog-${book.year}-journal.mp4`}><Download size={15} />MP4 저장 · {(result.size / 1024 / 1024).toFixed(1)}MB</a></div>}
  </div>;
}
