"use client";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronLeft, ChevronRight, Crop, Film, Hand, Highlighter, ImagePlus, Layers, MousePointer2, Pencil, Plus, Redo2, RotateCcw, RotateCw, Save, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { ArchiveMovie } from "@/lib/archive-movies";
import { newId, type FilmLog } from "@/lib/scene-store";
import { addJournalItem, itemHeight, journalStampLogs, placeOnSpread, spreadItems, type FilmJournal, type JournalItem, type JournalPage, type JournalPaper, type JournalCover } from "@/lib/journal-model";
import { importJournalPhoto } from "@/lib/journal-assets";
import { journalFontFamily, journalFonts } from "@/lib/journal-fonts";
import { fittedTextHeight } from "@/lib/journal-render";
import { JournalPageView } from "./journal-page";
import { JournalSpread, type JournalTool } from "./journal-spread";
import { JournalCrop } from "./journal-crop";
import { JournalExport } from "./journal-export";
import styles from "./film-journal.module.css";

function NumberField({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) { setPreviousValue(value); setDraft(String(value)); }
  function apply() { const next = draft.trim() === "" ? value : Math.max(min, Math.min(max, Number(draft))); if (Number.isFinite(next)) { setDraft(String(next)); if (next !== value) onChange(next); } else setDraft(String(value)); }
  return <input type="number" aria-label={label} min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={apply} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}
export function JournalStudio({ book, movies, logs, user, storageError, onChange, onClose }: {
  book: FilmJournal; movies: ArchiveMovie[]; logs: FilmLog[]; user: FilmLog["userId"]; storageError: boolean; onChange: (book: FilmJournal) => boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), viewport = useRef<HTMLDivElement>(null), photoInput = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState(0), [activePage, setActivePage] = useState(0), [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"stamps" | "text" | "photos" | "draw" | "share">("stamps"), [scope, setScope] = useState("year"), [query, setQuery] = useState("");
  const [flip, setFlip] = useState<{ from: number; to: number; direction: number } | null>(null), [opening, setOpening] = useState(true), [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<JournalTool>("select"), [zoom, setZoom] = useState(100), [fitWidth, setFitWidth] = useState(900);
  const [penColor, setPenColor] = useState("#e84b29"), [penSize, setPenSize] = useState(4), [cropOpen, setCropOpen] = useState(false), [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState(""); const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const past = useRef<FilmJournal[]>([]), future = useRef<FilmJournal[]>([]), current = useRef(book);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useLayoutEffect(() => { current.current = book; }, [book]);
  function refreshHistory() { setHistorySize({ past: past.current.length, future: future.current.length }); }
  useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close(); }, []);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(() => setFitWidth(Math.max(240, Math.min(element.clientWidth - 64, (element.clientHeight - 64) * 1.5)))); observer.observe(element); return () => observer.disconnect();
  }, []);
  const page = book.pages[activePage] ?? book.pages[start];
  const selectedPage = book.pages.find(p => p.items.some(item => item.id === selectedId));
  const selected = selectedPage?.items.find(item => item.id === selectedId);
  const stamps = journalStampLogs(logs, user, scope === "year" ? book.year : undefined).filter(log => movies.find(movie => movie.id === log.movieId)?.title.toLowerCase().includes(query.toLowerCase()));
  function commit(next: FilmJournal) { past.current = [...past.current.slice(-29), current.current]; future.current = []; current.current = next; onChange(next); refreshHistory(); setMessage(""); }
  function undo() { const previous = past.current.pop(); if (!previous) return; future.current.push(book); setSelectedId(null); setStart(0); setActivePage(0); onChange(previous); refreshHistory(); }
  function redo() { const next = future.current.pop(); if (!next) return; past.current.push(book); setSelectedId(null); onChange(next); refreshHistory(); }
  function patchItem(patch: Partial<JournalItem>) {
    if (!selected || !selectedPage) return;
    const index = book.pages.findIndex(p => p.id === selectedPage.id), next = { ...selected, ...patch, x: selected.x + index - start };
    if (patch.width !== undefined && !patch.crop && (selected.kind === "stamp" || selected.kind === "photo")) {
      const ratio = itemHeight(selected) / selected.width;
      next.width = Math.min(next.width, .98 / ratio); next.height = next.width * ratio;
    }
    commit(placeOnSpread(current.current, start, next));
  }
  function removeItem(id: string) { commit({ ...book, pages: book.pages.map(p => ({ ...p, items: p.items.filter(item => item.id !== id) })) }); setSelectedId(null); }
  function place(item: JournalItem) { commit(placeOnSpread(current.current, start, item)); if (tool === "select") { setSelectedId(item.id); setActivePage(start + (item.x + item.width / 2 >= 1 ? 1 : 0)); } }
  function add(item: JournalItem) { item.z = Math.max(0, ...spreadItems(current.current, start).map(i => i.z ?? 0)) + 1; commit(addJournalItem(current.current, page.id, item)); setSelectedId(item.id); setTool("select"); }
  function addStamp(log: FilmLog) { add({ id: newId(), kind: "stamp", movieId: log.movieId, logId: log.id, x: .12, y: .12, width: .34, rotation: 0 }); }
  function addText() { add({ id: newId(), kind: "text", text: "기억하고 싶은 장면", x: .12, y: .16, width: .72, height: .15, rotation: 0, font: "gowun", fontSize: 28, color: "#242424" }); setTab("text"); }
  async function addPhotos(files: File[]) {
    if (!files.length || photoBusy || busy) return; setPhotoBusy(true); setMessage("");
    try {
      const targetId = page.id;
      for (const file of files.slice(0, 12)) {
        const asset = await importJournalPhoto(file), width = Math.min(.62, .72 * 600 / 450 * asset.width / asset.height);
        const next = current.current;
        const item: JournalItem = { id: newId(), kind: "photo", assetId: asset.id, x: .14, y: .13, width, height: width * .75 * asset.height / asset.width, rotation: 0, z: Math.max(0, ...next.pages.flatMap(p => p.items.map(i => i.z ?? 0))) + 1 };
        commit(addJournalItem(next, targetId, item)); setSelectedId(item.id);
      }
      setTool("select"); setTab("photos");
    } catch (error) { setMessage(error instanceof Error ? error.message : "사진을 가져오지 못했어요."); }
    finally { setPhotoBusy(false); if (photoInput.current) photoInput.current.value = ""; }
  }
  function turn(direction: number) { const to = start + direction * 2; if (to < 0 || to >= book.pages.length || flip) return; setSelectedId(null); setFlip({ from: start, to, direction }); }
  function finishTurn() { if (flip) { setStart(flip.to); setActivePage(flip.to); setFlip(null); } }
  function addPages() { commit({ ...book, pages: [...book.pages, ...Array.from({ length: 2 }, (): JournalPage => ({ id: newId(), paper: "ivory", items: [] }))] }); setStart(book.pages.length); setActivePage(book.pages.length); setSelectedId(null); }
  function autoFill() {
    const entries = journalStampLogs(logs, user, book.year).filter(log => movies.some(movie => movie.id === log.movieId)); if (!entries.length) return;
    const pages: JournalPage[] = entries.map((log, index) => ({ id: newId(), paper: index % 2 ? "grid" : "ivory", items: [
      { id: newId(), kind: "text", text: log.watchedOn.replaceAll("-", "."), x: .13, y: .06, width: .7, height: .07, rotation: 0, font: "gowun", fontSize: 21, color: "#252522" },
      { id: newId(), kind: "stamp", movieId: log.movieId, logId: log.id, x: .2, y: .16, width: .43, rotation: index % 2 ? 4 : -4 },
      { id: newId(), kind: "text", text: log.review.length > 100 ? log.review.slice(0, 100) + "…" : log.review || "이 장면을 기억하고 싶어서.", x: .14, y: .73, width: .72, height: .2, rotation: 0, font: "gowun", fontSize: 16, color: "#403b32" },
    ] }));
    while (pages.length < 2 || pages.length % 2) pages.push({ id: newId(), paper: "ivory", items: [] }); commit({ ...book, pages }); setStart(0); setActivePage(0);
  }
  const visibleIndices = flip ? (flip.direction > 0 ? [flip.from, flip.to + 1] : [flip.to, flip.from + 1]) : [start, start + 1];
  const frontIndex = flip ? flip.direction > 0 ? flip.from + 1 : flip.from : 0, backIndex = flip ? flip.direction > 0 ? flip.to : flip.to + 1 : 0;
  function chooseTool(value: JournalTool) { setTool(value); if (value === "pen" || value === "marker") { setTab("draw"); setSelectedId(null); } }
  return <dialog ref={dialog} className={styles.studio} aria-label={`${book.year}년 영화 다이어리 꾸미기`} onCancel={onClose} onPaste={event => {
    const files = [...event.clipboardData.files].filter(file => file.type.startsWith("image/")); if (files.length) { event.preventDefault(); void addPhotos(files); }
  }}>
    <header className={styles.studioHeader}><div><span>MY FILM JOURNAL / {book.year}</span><input aria-label="다이어리 제목" value={book.title} maxLength={36} disabled={busy} onChange={event => commit({ ...book, title: event.target.value })} /></div><span className={styles.saveState} role="status">{storageError ? "저장 공간을 확인해 주세요" : <><Check size={12} />자동 저장됨</>}</span><button className={styles.saveButton} disabled={busy || photoBusy} onClick={() => setMessage(onChange(current.current) ? "저장했어요. 이 브라우저에서 다시 열 수 있어요." : "저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.")}><Save size={15} />저장</button><button aria-label="다이어리 닫기" onClick={onClose}><X size={21} /></button></header>
    <div className={styles.studioBody}>
      <div className={styles.workspace} data-busy={busy}>
        <div className={styles.bookTools}><div className={styles.toolModes}>{([["select", MousePointer2, "선택"], ["hand", Hand, "화면 이동"], ["pen", Pencil, "펜"], ["marker", Highlighter, "형광펜"]] as const).map(([value, Icon, label]) => <button key={value} aria-label={label} title={label} aria-pressed={tool === value} onClick={() => chooseTool(value)}><Icon size={16} /></button>)}</div><div><button aria-label="다이어리 실행 취소" disabled={!historySize.past || busy} onClick={undo}><Undo2 size={16} /></button><button aria-label="다이어리 다시 실행" disabled={!historySize.future || busy} onClick={redo}><Redo2 size={16} /></button><button onClick={addPages} disabled={busy}><Plus size={14} />페이지 추가</button></div></div>
        <div ref={viewport} className={styles.bookViewport} data-tool={tool} onPointerDown={event => {
          if (tool !== "hand" || event.button !== 0) return; const el = event.currentTarget; pan.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }; el.setPointerCapture(event.pointerId);
        }} onPointerMove={event => { if (pan.current) { event.currentTarget.scrollLeft = pan.current.left - event.clientX + pan.current.x; event.currentTarget.scrollTop = pan.current.top - event.clientY + pan.current.y; } }} onPointerUp={() => { pan.current = null; }} onPointerCancel={() => { pan.current = null; }}>
          <div className={styles.bookStage} style={{ "--book-width": `${fitWidth * zoom / 100}px` } as CSSProperties}>
            <div className={styles.spread} data-opening={opening}>
              {flip ? visibleIndices.map(index => book.pages[index] && <JournalPageView key={index} page={book.pages[index]} number={index + 1} movies={movies} logs={logs} book={book} />) : <JournalSpread key={start} book={book} start={start} movies={movies} logs={logs} selected={selectedId} tool={tool} penColor={penColor} penSize={penSize} locked={busy} onPlace={place} onDelete={removeItem} onEditPhoto={() => setCropOpen(true)} onSelect={(id, side) => { setActivePage(start + side); setSelectedId(id); const kind = spreadItems(book, start).find(item => item.id === id)?.kind; if (kind === "text") setTab("text"); if (kind === "photo") setTab("photos"); }} />}
              {flip && <div className={styles.turningLeaf} data-direction={flip.direction} onAnimationEnd={finishTurn}><div className={styles.leafFront}><JournalPageView page={book.pages[frontIndex]} number={frontIndex + 1} movies={movies} logs={logs} book={book} /></div><div className={styles.leafBack}><JournalPageView page={book.pages[backIndex]} number={backIndex + 1} movies={movies} logs={logs} book={book} /></div></div>}
              {opening && <div className={styles.openingLeaves} aria-hidden="true" onAnimationEnd={event => { if ((event.target as HTMLElement).dataset.last) setOpening(false); }}>{[0, 1, 2].map(index => <div key={index} data-last={index === 2 ? "true" : undefined} style={{ animationDelay: `${index * 90}ms` }}><small>SCENELOG</small><strong>{book.year}</strong><span>{book.title}</span></div>)}</div>}
            </div>
          </div>
        </div>
        <div className={styles.stageBottom}><div className={styles.zoomTools}><button aria-label="다이어리 축소" disabled={zoom <= 50} onClick={() => setZoom(Math.max(50, zoom - 25))}><ZoomOut size={16} /></button><NumberField label="다이어리 확대 비율" value={zoom} min={50} max={300} onChange={setZoom} /><span>%</span><button aria-label="다이어리 확대" disabled={zoom >= 300} onClick={() => setZoom(Math.min(300, zoom + 25))}><ZoomIn size={16} /></button><button onClick={() => { setZoom(100); viewport.current?.scrollTo(0, 0); }}>화면 맞춤</button></div><div className={styles.pageNav}><button aria-label="이전 다이어리 페이지" disabled={start === 0 || !!flip || busy} onClick={() => turn(-1)}><ChevronLeft size={18} /></button><span>{start + 1}–{start + 2}<small>/ {book.pages.length}</small></span><button aria-label="다음 다이어리 페이지" disabled={start + 2 >= book.pages.length || !!flip || busy} onClick={() => turn(1)}><ChevronRight size={18} /></button></div></div>
        <p className={styles.stageHint}>모서리를 잡아 크기 조절 · 글자는 더블클릭 · 두 페이지 사이로 자유롭게 이동 · 확대 후 손 도구로 화면 이동</p>
      </div>
      <aside className={styles.editor}>
        <nav className={styles.editorTabs} aria-label="다이어리 편집 도구">{([["stamps", Layers, "우표"], ["text", Type, "글"], ["photos", ImagePlus, "사진"], ["draw", Pencil, "그림"], ["share", Film, "영상"]] as const).map(([value, Icon, name]) => <button key={value} aria-pressed={tab === value} disabled={busy} onClick={() => { setTab(value); if (value !== "draw") setTool("select"); }}><Icon size={16} />{name}</button>)}</nav>
        <div className={styles.editorContent}>
          {message && <p role="status" className={styles.notice}>{message}</p>}
          {tab === "share" ? <JournalExport key={book.updatedAt} book={book} movies={movies} logs={logs} onBusy={setBusy} /> : <>
            <div className={styles.targetPage}><span>지금 꾸미는 페이지</span><select aria-label="꾸밀 페이지" value={activePage} onChange={event => { const index = Number(event.target.value); setActivePage(index); setStart(Math.floor(index / 2) * 2); setSelectedId(null); }}>{book.pages.map((page, index) => <option key={page.id} value={index}>{index + 1}쪽</option>)}</select></div>
            {tab === "stamps" && <><label className={styles.field}>우표 가져오기<select aria-label="우표 기록 범위" value={scope} onChange={event => setScope(event.target.value)}><option value="year">{book.year}년에 본 영화</option><option value="all">내 모든 관람 기록</option></select></label><input className={styles.stampSearch} aria-label="다이어리 우표 검색" placeholder="영화 제목으로 찾기" value={query} onChange={event => setQuery(event.target.value)} /><div className={styles.stickerTray}>{stamps.map(log => { const movie = movies.find(movie => movie.id === log.movieId)!; return <button key={log.id} onClick={() => addStamp(log)} aria-label={`${movie.title} 우표 붙이기`}><Image width={100} height={150} sizes="90px" src={movie.poster} alt="" /><strong>{movie.title}</strong><small>★ {log.rating?.toFixed(1) ?? "미평가"}</small></button>; })}</div>{!stamps.length && <p className={styles.quiet}>이 범위에는 기록한 영화가 없어요.</p>}{book.pages.every(p => !p.items.length) && <button className={styles.lightButton} disabled={!stamps.length} onClick={autoFill}>올해의 기록으로 첫 장 꾸미기</button>}</>}
            {tab === "text" && <><button className={styles.darkButton} onClick={addText}><Plus size={14} />문장 붙이기</button>{selected?.kind === "text" ? <><label className={styles.field}>문장<textarea aria-label="다이어리 문장" maxLength={3000} value={selected.text ?? ""} onChange={event => patchItem({ text: event.target.value })} /></label><div className={styles.fontControls}><label>글꼴<select aria-label="다이어리 글꼴" value={selected.font ?? "sans"} onChange={event => patchItem({ font: event.target.value as JournalItem["font"] })}>{journalFonts.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label><label>크기<NumberField label="다이어리 글자 크기" value={selected.fontSize ?? 25} min={8} max={120} onChange={fontSize => patchItem({ fontSize })} /></label></div><div className={styles.fontPreview} style={{ fontFamily: journalFontFamily(selected.font) }}>오래 기억하고 싶은 장면.</div><div className={styles.alignTools}>{([["left", AlignLeft, "왼쪽 정렬"], ["center", AlignCenter, "가운데 정렬"], ["right", AlignRight, "오른쪽 정렬"]] as const).map(([align, Icon, label]) => <button key={align} aria-label={label} aria-pressed={(selected.align ?? "left") === align} onClick={() => patchItem({ align })}><Icon size={17} /></button>)}<input aria-label="글자 색" type="color" value={selected.color ?? "#242424"} onChange={event => patchItem({ color: event.target.value })} /></div><button className={styles.lightButton} onClick={() => patchItem({ height: fittedTextHeight(selected) })}>글자에 맞춰 상자 높이 조절</button></> : <p className={styles.quiet}>문장을 선택하면 글꼴과 정렬을 바꿀 수 있어요. 페이지에서 더블클릭하면 바로 쓸 수 있어요.</p>}</>}
            {tab === "photos" && <><input ref={photoInput} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-label="다이어리에 붙일 사진" onChange={event => void addPhotos([...event.target.files ?? []])} /><button className={styles.darkButton} disabled={photoBusy} onClick={() => photoInput.current?.click()}><ImagePlus size={16} />{photoBusy ? "사진 가져오는 중…" : "앨범에서 사진 가져오기"}</button><p className={styles.quiet}>JPG · PNG · WebP · GIF / 장당 25MB까지<br />복사한 사진은 Ctrl+V로 붙여넣을 수도 있어요. 사진은 이 브라우저에 저장돼요.</p>{selected?.kind === "photo" && <button className={styles.lightButton} onClick={() => setCropOpen(true)}><Crop size={16} />자르기 · 자유 오리기</button>}</>}
            {tab === "draw" && <><span className={styles.panelEyebrow}>MAKE YOUR MARK</span><h3 className={styles.drawTitle}>여백 위에, 마음대로.</h3><div className={styles.segmented}><button aria-pressed={tool === "pen"} onClick={() => chooseTool("pen")}>펜</button><button aria-pressed={tool === "marker"} onClick={() => chooseTool("marker")}>형광펜</button><button aria-pressed={tool === "select"} onClick={() => chooseTool("select")}>선택</button></div><div className={styles.fontControls}><label>펜 색<input type="color" aria-label="펜 색" value={penColor} onChange={event => setPenColor(event.target.value)} /></label><label>굵기<NumberField label="펜 굵기" min={1} max={36} value={penSize} onChange={setPenSize} /></label></div><div className={styles.penPreview}><span style={{ height: penSize, background: penColor, opacity: tool === "marker" ? .32 : 1 }} /></div><p className={styles.quiet}>마우스나 손가락으로 그려보세요. 그린 선도 선택해서 옮기고, 크기를 바꾸거나 삭제할 수 있어요.</p></>}
            {selected && <div className={styles.selectionTools}><span>선택한 {selected.kind === "text" ? "문장" : selected.kind === "photo" ? "사진" : selected.kind === "drawing" ? "그림" : "우표"}</span><label>너비<NumberField label="조각 너비" value={Math.round(selected.width * 100)} min={7} max={190} onChange={value => { const ratio = value / 100 / selected.width; patchItem({ width: value / 100, ...(selected.kind === "photo" ? { height: Math.min(.98, itemHeight(selected) * ratio) } : {}) }); }} />%</label>{selected.kind === "text" && <label>높이<NumberField label="문장 상자 높이" value={Math.round(itemHeight(selected) * 100)} min={3} max={98} onChange={value => patchItem({ height: value / 100 })} />%</label>}<div><button aria-label="왼쪽으로 회전" onClick={() => patchItem({ rotation: selected.rotation - 5 })}><RotateCcw size={14} /></button><button aria-label="오른쪽으로 회전" onClick={() => patchItem({ rotation: selected.rotation + 5 })}><RotateCw size={14} /></button><span>{selected.rotation}°</span><button aria-label="맨 앞으로 가져오기" onClick={() => patchItem({ z: Math.max(0, ...spreadItems(book, start).map(item => item.z ?? 0)) + 1 })}><Layers size={14} /></button><button aria-label="선택한 조각 삭제" onClick={() => removeItem(selected.id)}><Trash2 size={14} /></button></div></div>}
            <details className={styles.pageSettings}><summary>종이와 표지</summary><label className={styles.field}>종이<select aria-label="다이어리 종이" value={page.paper} onChange={event => commit({ ...book, pages: book.pages.map(p => p.id === page.id ? { ...p, paper: event.target.value as JournalPaper } : p) })}><option value="ivory">아이보리</option><option value="grid">모눈</option><option value="white">화이트</option></select></label><label className={styles.field}>표지<select aria-label="다이어리 표지" value={book.cover} onChange={event => commit({ ...book, cover: event.target.value as JournalCover })}><option value="ink">잉크 블랙</option><option value="orange">씬 오렌지</option><option value="blue">미드나잇 블루</option></select></label></details>
          </>}
        </div>
      </aside>
    </div>
    {cropOpen && selected?.kind === "photo" && <JournalCrop key={selected.id} item={selected} onApply={patchItem} onClose={() => setCropOpen(false)} />}
  </dialog>;
}
