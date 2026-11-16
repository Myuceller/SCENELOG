import { isFilmJournal, type FilmJournal } from "./journal-model";

export type JournalBooks = Record<string, FilmJournal>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const journalStorageKey = (userId: string) => `scenelog.journals.v1:${userId}`;

export function readAccountJournals(storage: Storage, userId: string): JournalBooks {
  const raw = storage.getItem(journalStorageKey(userId));
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid journals");
  if (!Object.entries(parsed).every(([year, book]) => isFilmJournal(book) && String(book.year) === year)) throw new Error("Invalid journal");
  return parsed as JournalBooks;
}

/** Each store owns one authenticated account; the old demo storage is never read. */
export function createAccountJournalStore(userId: string, storage: () => Storage) {
  const empty = { books: {} as JournalBooks, storageError: false };
  let snapshot = empty;
  let loaded = false;
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    if (!loaded) {
      loaded = true;
      try { snapshot = { books: readAccountJournals(storage(), userId), storageError: false }; }
      catch { snapshot = { books: {}, storageError: true }; }
    }
    return snapshot;
  };
  return {
    key: journalStorageKey(userId),
    getSnapshot,
    getServerSnapshot: () => empty,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() { loaded = false; listeners.forEach(listener => listener()); },
    save(book: FilmJournal) {
      const current = getSnapshot();
      // Do not overwrite an unreadable archive with an empty one.
      if (current.storageError || !isFilmJournal(book)) return false;
      const books = { ...current.books, [book.year]: { ...book, updatedAt: new Date().toISOString() } };
      try {
        storage().setItem(journalStorageKey(userId), JSON.stringify(books));
        snapshot = { books, storageError: false };
        listeners.forEach(listener => listener());
        return true;
      } catch {
        snapshot = { ...current, storageError: true };
        listeners.forEach(listener => listener());
        return false;
      }
    },
  };
}
