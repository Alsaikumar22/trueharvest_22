
import { fetchChapterFromFirestore, fetchBookChapters } from './firebaseService';
import { BIBLE_METADATA } from './constants';
import type { Verse, BibleLanguage } from '../types';

// --- IndexedDB Setup ---
const DB_NAME = 'TrueHarvestDB';
const STORE_NAME = 'chapters';
const META_STORE = 'offline_meta'; // New store to track downloaded versions
const DB_VERSION = 2; // Incremented version for new store

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject("IndexedDB not supported");
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // Key will be "lang-version-book-chapter"
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'id' }); // To track "english_kjv", "telugu_bsi"
            }
        };
    });
};

// CRITICAL: Version must be part of the key to distinguish English translations
const getStorageKey = (lang: string, version: string, book: string, chapter: number) => 
    `${lang}_${version}_${book}_${chapter}`;

// --- Helper: Timeout Wrapper ---
// This ensures that if Firestore hangs (e.g. [code=unavailable]), we don't wait forever
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), ms);
        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

// --- Async Database Operations ---

export const markVersionAsDownloaded = async (lang: string, version: string) => {
    try {
        const db = await openDB();
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        store.put({ id: `${lang}_${version}`, timestamp: Date.now() });
    } catch (e) {
        console.error("Failed to mark download", e);
    }
};

export const isVersionDownloaded = async (lang: string, version: string): Promise<boolean> => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(META_STORE, 'readonly');
            const store = tx.objectStore(META_STORE);
            const req = store.get(`${lang}_${version}`);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
};

export const saveChapterLocally = async (lang: string, version: string, book: string, chapter: number, data: Verse): Promise<boolean> => {
    try {
        const db = await openDB();
        const key = getStorageKey(lang, version, book, chapter);
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(data, key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error("DB Save Error:", request.error);
                resolve(false);
            };
        });
    } catch (e) {
        console.error("Failed to save chapter to DB", e);
        return false;
    }
};

export const getChapterLocally = async (lang: string, version: string, book: string, chapter: number): Promise<Verse | null> => {
    try {
        const db = await openDB();
        const key = getStorageKey(lang, version, book, chapter);

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result as Verse : null);
            };
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
};

// --- Offline Download Logic ---
export const downloadFullBibleVersion = async (
    lang: string, 
    version: string, 
    onProgress: (progress: number, message: string) => void
) => {
    const safeVersion = version.trim();
    const books = BIBLE_METADATA;
    const totalBooks = books.length;
    let booksProcessed = 0;

    for (const bookMeta of books) {
        const bookName = bookMeta.en;
        onProgress(
            Math.round((booksProcessed / totalBooks) * 100), 
            `Downloading ${bookName}...`
        );

        // Fetch ALL chapters for this book in one request
        // This is much faster than fetching chapter by chapter
        const chapters = await fetchBookChapters(lang, bookName, safeVersion);
        
        if (chapters && chapters.length > 0) {
            // Save all chapters to IndexedDB
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            chapters.forEach(ch => {
                const key = getStorageKey(lang, safeVersion, bookName, ch.chapter);
                store.put(ch.verses, key);
            });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        booksProcessed++;
    }

    await markVersionAsDownloaded(lang, safeVersion);
    onProgress(100, "Download Complete");
};

// --- Static File Fetcher ---
const fetchStaticChapter = async (lang: string, book: string, chapter: number): Promise<Verse | null> => {
    // Static files are legacy/backup and might not support all versions structure
    // We treat them as a specific source, usually KJV or BSI default
    const safeBook = book.replace(/\s+/g, '_');
    const url = `/bible_data/${lang.toLowerCase()}/${safeBook}/${chapter}.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 

    try {
        const response = await fetch(url, { signal: controller.signal });
        
        if (response.ok) {
            const json = await response.json();
            if (typeof json === 'object' && json !== null) {
                return json as Verse;
            }
        }
    } catch (e) {
        // Silently fail
    } finally {
        clearTimeout(timeoutId);
    }
    return null;
}

// Main Fetch Function
export const fetchBibleChapter = async (
    language: BibleLanguage, 
    book: string, 
    chapter: number, 
    version: string = 'KJV'
): Promise<{ data: Verse | null, source: 'local' | 'cloud' | 'static' | 'none' }> => {
    
    // Normalize version for caching consistency
    const safeVersion = version.trim();

    // 1. Try IndexedDB (Cached) - STRICT VERSION MATCHING
    const localData = await getChapterLocally(language, safeVersion, book, chapter);
    if (localData) {
        return { data: localData, source: 'local' };
    }

    // 2. Try Firebase Firestore (Cloud Database) - STRICT VERSION QUERY
    try {
        // Wrap Firestore call in a timeout (2.5s).
        // If the backend is unreachable (offline or invalid config), this prevents the UI
        // from hanging indefinitely and forces a fallback to static files.
        const cloudData = await withTimeout(fetchChapterFromFirestore(language, book, chapter, safeVersion), 2500);
        
        if (cloudData) {
            // Cache successful cloud fetch to local with version info
            await saveChapterLocally(language, safeVersion, book, chapter, cloudData);
            return { data: cloudData, source: 'cloud' };
        }
    } catch (e) {
        // Log gracefully; this is expected if offline
        console.warn("Cloud fetch skipped (offline/slow): switching to fallback.");
    }

    // 3. Try Static JSON Files (Fallback, usually KJV/BSI only)
    // Only fallback if version matches defaults to avoid showing KJV when NIV requested
    if ((language === 'english' && safeVersion === 'KJV') || (language !== 'english')) {
        const staticData = await fetchStaticChapter(language, book, chapter);
        if (staticData) {
            return { data: staticData, source: 'static' };
        }
    }

    // 4. Strict: No AI Fallback allowed.
    return { data: null, source: 'none' };
};

export const deleteBibleVersion = async (lang: string, version: string) => {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const metaStore = tx.objectStore(META_STORE);
        
        metaStore.delete(`${lang}_${version}`);
        
        const prefix = `${lang}_${version}_`;
        const request = store.openKeyCursor();
        
        request.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
                const key = cursor.key as string;
                if (key.startsWith(prefix)) {
                    store.delete(key);
                }
                cursor.continue();
            }
        };

        return new Promise<boolean>((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.error("Failed to delete version", e);
        return false;
    }
};

/**
 * Parses a Bible reference string (e.g., "Psalm 37:4", "1 John 1:9", "Jn 3:16", "Gen. 1:1")
 * into its constituent parts: book, chapter, and verse.
 */
export const parseBibleReference = (ref: string) => {
    if (!ref) return null;
    
    // Clean the reference: remove trailing translations like (NIV), (KJV)
    const cleanRef = ref.replace(/\s*\([^)]+\)\s*$/, '').trim();
    
    // Regex to match "Book Chapter:Verse" or "1 Book Chapter:Verse"
    // Captures: (Book Name/Abbr) (Chapter):(Verse)
    // Verse is optional. Chapter is required.
    const match = cleanRef.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
    
    if (match) {
        let searchBook = match[1].trim().toLowerCase();
        // Remove trailing period if any (e.g., "Gen." -> "gen")
        if (searchBook.endsWith('.')) {
            searchBook = searchBook.slice(0, -1);
        }
        
        const chapter = parseInt(match[2]);
        const verse = match[3] ? parseInt(match[3]) : null;

        // Common abbreviations map
        const abbrMap: Record<string, string> = {
            'gen': 'Genesis', 'ex': 'Exodus', 'exo': 'Exodus', 'lev': 'Leviticus', 'num': 'Numbers', 
            'deut': 'Deuteronomy', 'josh': 'Joshua', 'judg': 'Judges', 'ruth': 'Ruth', 
            'sam': 'Samuel', 'kgs': 'Kings', 'chr': 'Chronicles', 'neh': 'Nehemiah', 
            'est': 'Esther', 'job': 'Job', 'ps': 'Psalm', 'pss': 'Psalm', 'psalm': 'Psalm', 'psalms': 'Psalm',
            'prov': 'Proverbs', 'pro': 'Proverbs', 'ecc': 'Ecclesiastes', 'song': 'Song of Solomon', 
            'isa': 'Isaiah', 'jer': 'Jeremiah', 'lam': 'Lamentations', 'eze': 'Ezekiel', 
            'dan': 'Daniel', 'hos': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obadiah', 
            'jon': 'Jonah', 'mic': 'Micah', 'nah': 'Nahum', 'hab': 'Habakkuk', 'zeph': 'Zephaniah', 
            'hag': 'Haggai', 'zech': 'Zechariah', 'mal': 'Malachi', 'matt': 'Matthew', 
            'mark': 'Mark', 'luke': 'Luke', 'john': 'John', 'jn': 'John', 'acts': 'Acts', 
            'rom': 'Romans', 'cor': 'Corinthians', 'gal': 'Galatians', 'eph': 'Ephesians', 
            'phil': 'Philippians', 'col': 'Colossians', 'thess': 'Thessalonians', 
            'tim': 'Timothy', 'titus': 'Titus', 'phlm': 'Philemon', 'heb': 'Hebrews', 
            'jas': 'James', 'pet': 'Peter', 'jude': 'Jude', 'rev': 'Revelation'
        };

        // 1. Try exact match or common normalization
        let foundBook = BIBLE_METADATA.find(b => 
            b.en.toLowerCase() === searchBook || 
            (searchBook === 'psalms' && b.en === 'Psalm') ||
            (searchBook === 'proverb' && b.en === 'Proverbs') ||
            (searchBook === 'revelations' && b.en === 'Revelation')
        );

        // 2. Try abbreviation map
        if (!foundBook) {
            // Handle numbered books (e.g., "1jn" -> "1 John")
            const numberedMatch = searchBook.match(/^(\d)\s*(.*)/);
            if (numberedMatch) {
                const num = numberedMatch[1];
                const rest = numberedMatch[2].trim();
                const mappedRest = abbrMap[rest] || rest;
                const potentialName = `${num} ${mappedRest}`;
                foundBook = BIBLE_METADATA.find(b => b.en.toLowerCase() === potentialName.toLowerCase());
            } else {
                const mappedName = abbrMap[searchBook];
                if (mappedName) {
                    foundBook = BIBLE_METADATA.find(b => b.en.toLowerCase() === mappedName.toLowerCase());
                }
            }
        }

        if (foundBook) {
            return { book: foundBook.en, chapter, verse };
        }
        
        // Fallback capitalization if not in metadata
        const book = match[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        return { book, chapter, verse };
    }
    return null;
};
