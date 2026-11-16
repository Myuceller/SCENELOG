"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { decodeJournalPhoto, readJournalPhoto } from "@/lib/journal-assets";
import type { CropRect, JournalItem } from "@/lib/journal-model";
import styles from "./film-journal.module.css";
export function JournalCrop({ item, onApply, onClose }: { item: JournalItem; onApply: (patch: Partial<JournalItem>) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), surface = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null), [error, setError] = useState("");
  const [crop, setCrop] = useState<CropRect>(item.crop ?? { x: 0, y: 0, width: 1, height: 1 });
  const [mode, setMode] = useState<"rect" | "cut">("rect"), [mask, setMask] = useState(item.mask ?? "rect");
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const drag = useRef<{ x: number; y: number; crop: CropRect; resize: boolean } | null>(null);
  useEffect(() => { let disposed = false; void readJournalPhoto(item.assetId!).then(decodeJournalPhoto).then(img => { if (!disposed) setImage(img); }).catch(e => setError(e.message)); return () => { disposed = true; }; }, [item.assetId]);
  useEffect(() => { if (!image || !canvas.current) return; canvas.current.width = image.width; canvas.current.height = image.height; canvas.current.getContext("2d")!.drawImage(image, 0, 0); }, [image]);
  function begin(event: PointerEvent<HTMLElement>, resize: boolean) {
    if (mode !== "rect") return; event.stopPropagation(); event.preventDefault();
    const rect = surface.current!.getBoundingClientRect(); drag.current = { x: event.clientX / rect.width, y: event.clientY / rect.height, crop, resize }; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return; const origin = drag.current, rect = surface.current!.getBoundingClientRect(), dx = event.clientX / rect.width - origin.x, dy = event.clientY / rect.height - origin.y;
    setCrop(origin.resize ? { ...origin.crop, width: Math.max(.05, Math.min(1 - origin.crop.x, origin.crop.width + dx)), height: Math.max(.05, Math.min(1 - origin.crop.y, origin.crop.height + dy)) } : { ...origin.crop, x: Math.max(0, Math.min(1 - origin.crop.width, origin.crop.x + dx)), y: Math.max(0, Math.min(1 - origin.crop.height, origin.crop.y + dy)) });
  }
  return <div className={styles.cropOverlay} role="dialog" aria-modal="true" aria-label="사진 자르기" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className={styles.cropPanel}><header><div><small>PHOTO STUDIO</small><h3>필요한 장면만 남기기</h3></div><button onClick={onClose} aria-label="사진 자르기 닫기">×</button></header>
      <div className={styles.segmented}><button aria-pressed={mode === "rect"} onClick={() => setMode("rect")}>사각형 자르기</button><button aria-pressed={mode === "cut"} onClick={() => { setMode("cut"); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }}>자유 오리기</button></div>
      <p>{mode === "rect" ? "영역을 끌어 옮기고, 오른쪽 아래 모서리로 크기를 조절하세요." : "남길 영역의 테두리를 차례로 클릭하세요. 점 3개 이상을 연결하면 오릴 수 있어요."}</p>
      <div ref={surface} className={styles.cropSurface} style={{ aspectRatio: image ? image.width / image.height : 1, width: image ? `min(100%, ${52 * image.width / image.height}dvh)` : "100%" }} onClick={event => {
        if (mode !== "cut") return; const rect = surface.current!.getBoundingClientRect(); setPoints([...points, { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }]);
      }}><canvas ref={canvas} />
        {mode === "rect" ? <div className={styles.cropRect} style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} onPointerDown={event => begin(event, false)} onPointerMove={move} onPointerUp={() => { drag.current = null; }}><button aria-label="자를 영역 크기 조절" onPointerDown={event => begin(event, true)} onPointerMove={event => { event.stopPropagation(); move(event); }} onPointerUp={event => { event.stopPropagation(); drag.current = null; }} /></div>
          : <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={points.map(p => `${p.x * 100},${p.y * 100}`).join(" ")} fill="#ff572233" stroke="#ff5722" strokeWidth=".4" />{points.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 100} r=".8" fill="white" stroke="#ff5722" strokeWidth=".3" />)}</svg>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <footer><button className={styles.lightButton} onClick={() => { setCrop({ x: 0, y: 0, width: 1, height: 1 }); setPoints([]); }}>원본으로</button>{mode === "rect" && <select aria-label="사진 테두리 모양" value={mask} onChange={event => setMask(event.target.value as typeof mask)}><option value="rect">직사각형</option><option value="rounded">둥근 모서리</option><option value="circle">원형</option></select>}<button className={styles.darkButton} disabled={!image || mode === "cut" && points.length < 3} onClick={() => {
        if (!image) return;
        let finalCrop = crop, cutout = mode === "cut" ? points : undefined;
        if (mode === "cut") {
          const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
          const width = Math.max(...points.map(p => p.x)) - x, height = Math.max(...points.map(p => p.y)) - y;
          if (width < .005 || height < .005) { setError("면적이 있는 모양으로 점을 찍어주세요."); return; }
          finalCrop = { x, y, width, height }; cutout = points.map(p => ({ x: (p.x - x) / width, y: (p.y - y) / height }));
        }
        if (mask === "circle" && mode === "rect") {
          const side = Math.min(finalCrop.width * image.width, finalCrop.height * image.height), width = side / image.width, height = side / image.height;
          finalCrop = { x: finalCrop.x + (finalCrop.width - width) / 2, y: finalCrop.y + (finalCrop.height - height) / 2, width, height };
        }
        const ratio = image.height * finalCrop.height / (image.width * finalCrop.width);
        const height = Math.min(.95, item.width * .75 * ratio), width = height / (.75 * ratio);
        onApply({ crop: finalCrop, mask: mode === "cut" ? "rect" : mask, cutout, width, height }); onClose();
      }}>적용하기</button></footer>
    </div>
  </div>;
}
