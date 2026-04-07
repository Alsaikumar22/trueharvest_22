
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BOOK_METADATA_MAP, BIBLE_METADATA } from '../services/constants';
import { fetchBibleChapter, downloadFullBibleVersion, isVersionDownloaded, parseBibleReference, deleteBibleVersion } from '../services/bibleService';
import { generateSpeech } from '../services/geminiService';
import { updateMetadata } from '../services/seoService';
import { motion, AnimatePresence } from 'motion/react';
import type { Page, BibleLanguage, EnglishVersion, Verse } from '../types';
import HomeIcon from './icons/HomeIcon';
import BookmarkIcon from './icons/BookmarkIcon';
import HighlightIcon from './icons/HighlightIcon';
import NoteIcon from './icons/NoteIcon';
import ShareIcon from './icons/ShareIcon';
import XIcon from './icons/XIcon';
import CopyIcon from './icons/CopyIcon';
import ViewColumnsIcon from './icons/ViewColumnsIcon';
import SparklesIcon from './icons/SparklesIcon';
import VerseSummaryModal from './VerseSummaryModal';
import VerseInsightPanel from './VerseInsightPanel';
import NoteModal from './NoteModal';
import ChevronDownIcon from './icons/ChevronDownIcon';
import BibleSharePopover from './BibleSharePopover';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import SearchIcon from './icons/SearchIcon';
import DownloadIcon from './icons/DownloadIcon';
import CheckIcon from './icons/CheckIcon';
import TextSizeIcon from './icons/TextSizeIcon';

const BIBLE_READER_PREFS_KEY = 'trueHarvestBibleReaderPrefs';
const BIBLE_BOOKMARKS_KEY = 'trueHarvestBibleBookmarks';
const BIBLE_HIGHLIGHTS_KEY = 'trueHarvestBibleHighlights';
const BIBLE_NOTES_KEY = 'trueHarvestBibleNotes';

// --- Pure Helper Functions (Top Level) ---

const toSafeString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return val.toString();
    if (val === null || val === undefined) return "";
    try {
        return JSON.stringify(val);
    } catch {
        return "[Data Error]";
    }
};

const getChapterKey = (lang: string, b: string, c: number, v: string) => {
    const effectiveVersion = lang === 'english' ? v : 'BSI';
    return `${lang}-${b}-${c}-${effectiveVersion}`;
};

// Regex to capture Bible references: e.g. "John 3:16", "1 Cor 13:4-8", "Gen 1:1"
const REF_REGEX = /(\b(?:(?:1|2|3|I|II|III)\s?)?[A-Z][a-z]+\.?\s+\d+:\d+(?:-\d+)?\b)/g;

function decodeBase64(base64: string): Uint8Array {
  try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  } catch (e) {
      console.error("Base64 decode failed", e);
      return new Uint8Array(0);
  }
}

async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Sub-components ---

interface PreviewData {
    refString: string;
    text: string | null;
    loading: boolean;
    targetBook: string | null;
    targetChapter: number | null;
}

const SkeletonVerseRow: React.FC = () => (
    <div className="animate-pulse flex items-start p-3 border-b border-slate-100 dark:border-white/5">
        <div className="h-4 w-6 bg-slate-200 dark:bg-white/10 rounded mr-3 mt-1"></div>
        <div className="flex-1 space-y-2">
             <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-full"></div>
             <div className="h-3 bg-slate-100 dark:bg-white/5 rounded w-5/6"></div>
        </div>
    </div>
);

const DownloadModal: React.FC<{ onClose: () => void; onDownloadComplete: () => void }> = ({ onClose, onDownloadComplete }) => {
    const [downloading, setDownloading] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState("");
    const [localVersions, setLocalVersions] = useState<Set<string>>(new Set());

    const options = [
        { lang: 'English', id: 'english', versions: ['KJV', 'NKJV', 'AMP', 'ESV', 'NIV', 'AKJV', 'EHV'] },
        { lang: 'Telugu', id: 'telugu', versions: ['BSI'] },
        { lang: 'Tamil', id: 'tamil', versions: ['BSI'] },
        { lang: 'Hindi', id: 'hindi', versions: ['BSI'] },
        { lang: 'Kannada', id: 'kannada', versions: ['BSI'] },
        { lang: 'Malayalam', id: 'malayalam', versions: ['BSI'] },
    ];

    useEffect(() => {
        checkDownloads();
    }, []);

    const checkDownloads = async () => {
        const locals = new Set<string>();
        for (const opt of options) {
            for (const v of opt.versions) {
                const isDown = await isVersionDownloaded(opt.id, v);
                if (isDown) locals.add(`${opt.id}_${v}`);
            }
        }
        setLocalVersions(locals);
    };

    const handleDownload = async (lang: string, version: string) => {
        const key = `${lang}_${version}`;
        if (downloading) return;
        
        setDownloading(key);
        setProgress(0);
        setStatusMsg("Initializing...");

        try {
            await downloadFullBibleVersion(lang, version, (p, msg) => {
                setProgress(p);
                setStatusMsg(msg);
            });
            await checkDownloads();
            onDownloadComplete();
        } catch (e) {
            console.error(e);
            setStatusMsg("Download failed. Please check your connection.");
        } finally {
            setDownloading(null);
            setProgress(0);
        }
    };

    const handleDelete = async (lang: string, version: string) => {
        const success = await deleteBibleVersion(lang, version);
        if (success) {
            await checkDownloads();
            onDownloadComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-white">Offline Library</h3>
                        <p className="text-slate-400 text-xs mt-1">Download versions to read without internet.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"><XIcon className="h-5 w-5" /></button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {downloading && (
                        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
                            <div className="flex justify-between text-xs font-bold text-amber-400 mb-2 uppercase tracking-widest">
                                <span>Downloading...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                                <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-400 text-center">{statusMsg}</p>
                        </div>
                    )}

                    {options.map((opt) => (
                        <div key={opt.id} className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">{opt.lang}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {opt.versions.map(ver => {
                                    const key = `${opt.id}_${ver}`;
                                    const isDownloaded = localVersions.has(key);
                                    const isBusy = downloading === key;
                                    
                                    return (
                                        <button
                                            key={ver}
                                            onClick={() => !isDownloaded && handleDownload(opt.id, ver)}
                                            disabled={isDownloaded || !!downloading}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                isDownloaded 
                                                ? 'bg-green-500/10 border-green-500/30 cursor-default' 
                                                : isBusy
                                                ? 'bg-amber-500/10 border-amber-500/50 cursor-wait'
                                                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                                            }`}
                                        >
                                            <span className={`font-bold ${isDownloaded ? 'text-green-400' : 'text-slate-200'}`}>
                                                {opt.lang === 'English' ? ver : opt.lang}
                                            </span>
                                            {isDownloaded ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center text-green-500 text-[10px] font-bold uppercase tracking-wide gap-1">
                                                        <span>Saved</span>
                                                        <CheckIcon className="h-4 w-4" />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(opt.id, ver); }}
                                                        className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                        title="Delete Version"
                                                    >
                                                        <XIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-slate-500">
                                                    {isBusy ? (
                                                        <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                                                    ) : (
                                                        <DownloadIcon className="h-4 w-4" />
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ReferencePreviewModal: React.FC<{
    data: PreviewData | null;
    onClose: () => void;
    onNavigate: () => void;
}> = ({ data, onClose, onNavigate }) => {
    if (!data) return null;
    return (
        <div 
            className="fixed inset-0 z-[10001] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh] animate-fadeInUp"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-slate-950/80">
                    <h3 className="font-serif font-bold text-amber-600 dark:text-amber-500 text-lg flex items-center gap-2">
                        <span className="bg-amber-500/10 p-1 rounded-md text-amber-500 dark:text-amber-400 text-xs uppercase tracking-wider">Ref</span>
                        {data.refString}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <XIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar bg-white/50 dark:bg-slate-900/50">
                    {data.loading ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
                            <span className="text-xs text-slate-500 font-medium">Fetching scripture...</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xl font-serif text-slate-800 dark:text-slate-200 leading-relaxed">
                                {data.text || <span className="text-slate-500 italic">Text unavailable for this reference.</span>}
                            </p>
                        </div>
                    )}
                </div>

                {!data.loading && data.targetBook && (
                    <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 flex gap-3">
                        <button 
                            onClick={onNavigate}
                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                        >
                            <span>Go to Chapter</span>
                            <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const VerseTextWithLinks: React.FC<{ 
    text: string; 
    onRefClick: (ref: string) => void; 
    className?: string; 
    enabled: boolean;
}> = React.memo(({ text, onRefClick, className, enabled }) => {
    if (!enabled || !text) return <p className={className}>{text}</p>;

    const parts = text.split(REF_REGEX);

    return (
        <p className={className}>
            {parts.map((part, i) => {
                if (part.match(REF_REGEX)) {
                    return (
                        <span 
                            key={i} 
                            onClick={(e) => { e.stopPropagation(); onRefClick(part); }}
                            className="text-amber-600 dark:text-amber-500 font-bold cursor-pointer hover:underline decoration-dotted underline-offset-4 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                            title={`Preview ${part}`}
                        >
                            {part}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </p>
    );
});

const VerseRow = React.memo(({ verseNum, text, language, isSelected, hasBookmark, highlightColor, hasNote, isPlaying, onSelect, onRefClick, fontSizeClass }: any) => {
    // Dynamic Font Size Class + Base styles
    const baseFont = language === 'english' ? 'font-serif leading-loose' : 'font-sans leading-[2.2] tracking-wide';
    
    return (
        <div 
            id={`v-${verseNum}`}
            onClick={(e) => onSelect(e, verseNum)}
            className={`group relative transition-all duration-200 cursor-pointer px-3 py-2 rounded-lg mb-0.5 ${isSelected ? 'bg-amber-100 dark:bg-amber-900/20 ring-1 ring-amber-500/30' : 'hover:bg-slate-100 dark:hover:bg-white/5'} ${isPlaying ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}
            style={highlightColor ? { backgroundColor: highlightColor + '33' } : {}}
        >
            <div className={`flex gap-3 items-baseline relative z-10 ${language === 'arabic' ? 'flex-row-reverse text-right' : ''}`}>
                <span className={`flex-shrink-0 w-6 font-sans text-[10px] font-bold transition-colors ${isSelected || isPlaying ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'} ${language === 'arabic' ? 'text-left' : 'text-right'} mt-1`}>
                    {verseNum}
                </span>
                <VerseTextWithLinks 
                    text={toSafeString(text)} 
                    onRefClick={onRefClick}
                    className={`${fontSizeClass} text-slate-700 dark:text-slate-300 w-full ${baseFont}`}
                    enabled={language === 'english'} 
                />
            </div>
            <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-60">
                {hasNote && (
                    <NoteIcon className="h-3 w-3 text-amber-500" />
                )}
                {hasBookmark && (
                    <BookmarkIcon filled className="h-3 w-3 text-red-500 dark:text-red-400" />
                )}
            </div>
        </div>
    );
});

const ParallelVerseRow = React.memo(({ verseNum, text1, text2, lang1, lang2, isSelected, highlightColor, hasNote, onSelect, onRefClick, fontSizeClass }: any) => {
    const fontClass1 = lang1 === 'english' ? 'font-serif leading-loose' : 'font-sans leading-[2.0]';
    const fontClass2 = lang2 === 'english' ? 'font-serif leading-loose' : 'font-sans leading-[2.0]';

    return (
        <div 
            id={`v-${verseNum}`}
            onClick={(e) => onSelect(e, verseNum)}
            className={`group transition-all duration-200 cursor-pointer border-b border-slate-100 dark:border-white/5 ${isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
            style={highlightColor ? { backgroundColor: highlightColor + '22' } : {}}
        >
            <div className="flex flex-col md:grid md:grid-cols-2 relative">
                <div className={`p-3 md:p-4 flex gap-3 border-r border-slate-100 dark:border-white/5 ${isSelected ? 'bg-amber-100/50 dark:bg-amber-900/5' : ''} ${lang1 === 'arabic' ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="flex items-start flex-shrink-0 w-6 mt-1">
                        <span className={`font-sans text-[10px] font-bold ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>{verseNum}</span>
                    </div>
                    <VerseTextWithLinks 
                        text={toSafeString(text1)}
                        onRefClick={onRefClick}
                        className={`${fontSizeClass} text-slate-700 dark:text-slate-300 ${fontClass1}`}
                        enabled={lang1 === 'english'}
                    />
                </div>
                <div className={`p-3 md:p-4 flex gap-3 ${isSelected ? 'bg-amber-100/50 dark:bg-amber-900/5' : 'bg-slate-50 dark:bg-black/10'} ${lang2 === 'arabic' ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="flex items-start flex-shrink-0 w-6 mt-1">
                        <span className="hidden md:block font-sans text-[10px] font-bold opacity-30 text-slate-400 dark:text-slate-600">{verseNum}</span>
                    </div>
                    <p className={`${fontSizeClass} text-slate-700 dark:text-slate-300 ${fontClass2}`}>
                        {toSafeString(text2) || <span className="opacity-10">...</span>}
                    </p>
                </div>

                <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-60">
                    {hasNote && (
                        <NoteIcon className="h-3 w-3 text-amber-500" />
                    )}
                </div>
            </div>
        </div>
    );
});

// --- Main Component ---

const BibleReader: React.FC<{ 
    setCurrentPage: (page: Page) => void;
    onCreateImage?: (text: string, reference: string) => void;
}> = ({ setCurrentPage, onCreateImage }) => {
    // === INITIALIZATION LOGIC (Fixing Persistence) ===
    const getInitialState = () => {
        // 1. Check Session Storage (Nav Intent from Plans/Search/Verse of Day) - HIGHEST PRIORITY
        try {
            const navIntent = sessionStorage.getItem('trueHarvestBibleNav');
            if (navIntent) {
                const nav = JSON.parse(navIntent);
                sessionStorage.removeItem('trueHarvestBibleNav');
                return {
                    book: nav.book || 'Genesis',
                    chapter: nav.chapter || 1,
                    language: (nav.language as BibleLanguage) || 'english',
                    verses: nav.verse ? [nav.verse] : [],
                    version: 'KJV' as EnglishVersion
                };
            }
        } catch(e) {}

        // 2. Check URL Parameters (Deep Linking priority if no internal intent)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const isBiblePage = params.get('page') === 'bible';
            if (isBiblePage && params.get('book')) {
                const versesParam = params.get('verses');
                return {
                    book: params.get('book') || 'Genesis',
                    chapter: parseInt(params.get('chapter') || '1'),
                    language: (params.get('lang') as BibleLanguage) || 'english',
                    verses: versesParam ? versesParam.split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : [],
                    version: 'KJV' as EnglishVersion
                };
            }
        }

        // 3. Check Local Storage (Last Visited State)
        try {
            const prefs = localStorage.getItem(BIBLE_READER_PREFS_KEY);
            if (prefs) {
                const p = JSON.parse(prefs);
                return {
                    book: p.book || 'Genesis',
                    chapter: p.chapter || 1,
                    language: p.language || 'english',
                    verses: [],
                    version: p.version || 'KJV',
                    compare: p.compare,
                    secL: p.secL,
                    secV: p.secV
                };
            }
        } catch(e) {}

        // 4. Default Fallback
        return { book: 'Genesis', chapter: 1, language: 'english' as BibleLanguage, verses: [], version: 'KJV' as EnglishVersion };
    };

    const initState = getInitialState();

    const [language, setLanguage] = useState<BibleLanguage>(initState.language);
    const [version, setVersion] = useState<EnglishVersion>(initState.version);
    const [book, setBook] = useState(initState.book);
    const [chapter, setChapter] = useState(initState.chapter);
    
    // Compare Mode State (Initialize from storage if available)
    const [isCompareMode, setIsCompareMode] = useState(initState.compare || false);
    const [secondaryLanguage, setSecondaryLanguage] = useState<BibleLanguage>(initState.secL || 'telugu');
    const [secondaryLanguageVersion, setSecondaryVersion] = useState<EnglishVersion>(initState.secV || 'NKJV');

    const [fetchedContent, setFetchedContent] = useState<Record<string, Verse>>({});
    const [dataSourceMap, setDataSourceMap] = useState<Record<string, 'cloud' | 'local' | 'static' | 'none'>>({});
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set(initState.verses));
    const [selectionMode, setSelectionMode] = useState<'verse' | null>(initState.verses.length > 0 ? 'verse' : null);
    const [toolbarPosition, setToolbarPosition] = useState<{top:number, left:number} | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showInsightPanel, setShowInsightPanel] = useState(false);
    const [showSharePopover, setShowSharePopover] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
    const [isOfflineReady, setIsOfflineReady] = useState(false);
    const [scrollTarget, setScrollTarget] = useState<'top' | 'bottom' | 'verse' | null>(initState.verses.length > 0 ? 'verse' : 'top');
    const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
    const [highlights, setHighlights] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const scrollContainerRef = useRef<HTMLElement | null>(null);

    // Font Size State: 0=Normal (lg), 1=Large (xl), 2=Huge (2xl)
    const [fontSizeIndex, setFontSizeIndex] = useState(0);
    const fontSizes = ['text-lg md:text-xl', 'text-xl md:text-2xl', 'text-2xl md:text-3xl'];

    // Audio State
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [playingVerseIndex, setPlayingVerseIndex] = useState<number | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const isPlayingRef = useRef(false);
    const playbackRateRef = useRef(1.0);
    const audioCacheRef = useRef<Record<number, Promise<AudioBuffer | null>>>({});

    // ... (Effects for offline check, SEO, URL updates remain same)
    const checkOfflineStatus = async () => {
        const targetVersion = language === 'english' ? version : 'BSI';
        const isReady = await isVersionDownloaded(language, targetVersion);
        setIsOfflineReady(isReady);
        
        // Show prompt if not downloaded, online, and not dismissed for this version
        const dismissed = sessionStorage.getItem(`dismiss_download_${language}_${targetVersion}`);
        if (!isReady && !dismissed && navigator.onLine) {
            setShowDownloadPrompt(true);
        } else {
            setShowDownloadPrompt(false);
        }
    };
    useEffect(() => { checkOfflineStatus(); }, [language, version]);

    useEffect(() => {
        if (!isLoadingContent && scrollTarget) {
            const timer = setTimeout(() => {
                if (!scrollContainerRef.current) return;
                if (scrollTarget === 'top') { try { scrollContainerRef.current.scrollTop = 0; } catch(e) {} }
                else if (scrollTarget === 'bottom') { try { scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; } catch(e) {} }
                else if (scrollTarget === 'verse' && selectedVerses.size > 0) {
                    const verseNum = Array.from(selectedVerses)[0];
                    const el = document.getElementById(`v-${verseNum}`);
                    if (el) try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
                }
                setScrollTarget(null);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isLoadingContent, scrollTarget, selectedVerses]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', 'bible');
        params.set('book', book);
        params.set('chapter', chapter.toString());
        params.set('lang', language);
        if (selectedVerses.size > 0) params.set('verses', Array.from(selectedVerses).sort((a: number, b: number) => a - b).join(','));
        else params.delete('verses');
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        try { window.history.replaceState(null, '', newUrl); } catch (e) {}
        
        // Metadata updates...
        const currentKey = getChapterKey(language, book, chapter, language === 'english' ? version : 'BSI');
        const content = fetchedContent[currentKey];
        const title = `${book} ${chapter} (${language === 'english' ? version : language.toUpperCase()})`;
        let description = `Read ${book} Chapter ${chapter} in ${language}. `;
        if (content) {
            const firstVerses = [1, 2, 3].map(v => content[v]).filter(Boolean).join(" ");
            if (firstVerses) description += `"${firstVerses.substring(0, 140)}..."`;
        }
        updateMetadata(title, description, `/?page=bible&book=${book}&chapter=${chapter}`);
    }, [book, chapter, language, version, selectedVerses, fetchedContent]);

    const sortedSelectedVerses = useMemo(() => Array.from(selectedVerses).sort((a: number, b: number) => a - b), [selectedVerses]);

    const handleExecuteSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if(!searchQuery.trim()) return;
        
        const parsed = parseBibleReference(searchQuery.trim());
        
        if (parsed) {
            setBook(parsed.book);
            const foundBook = BIBLE_METADATA.find(b => b.en === parsed.book);
            const safeChapter = Math.min(Math.max(1, parsed.chapter), foundBook?.chapters || 1);
            setChapter(safeChapter);
            
            if (parsed.verse) { 
                setSelectedVerses(new Set([parsed.verse])); 
                setScrollTarget('verse'); 
                setSelectionMode('verse'); 
                setToolbarPosition(null); 
            } else { 
                setSelectedVerses(new Set()); 
                setScrollTarget('top'); 
                setSelectionMode(null); 
            }
            setShowSearch(false); 
            setSearchQuery('');
        } else { 
            alert("Invalid format or Book not found. Try 'John 3:16' or 'Genesis 1'"); 
        }
    };

    // --- Audio Logic Improved ---
    const stopAudio = useCallback(() => {
        isPlayingRef.current = false;
        setIsAudioPlaying(false);
        setPlayingVerseIndex(null);
        if (sourceRef.current) {
            try { 
                sourceRef.current.stop(); 
                sourceRef.current.disconnect(); 
            } catch(e) { }
            sourceRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopAudio();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => {});
                audioContextRef.current = null;
            }
        };
    }, [stopAudio]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) stopAudio();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); };
    }, [stopAudio]);

    // Update the Ref and active source immediately when state changes
    useEffect(() => {
        playbackRateRef.current = playbackRate;
        if (sourceRef.current && audioContextRef.current) {
            try {
                // Use setValueAtTime for robust Web Audio API parameter updates
                sourceRef.current.playbackRate.setValueAtTime(playbackRate, audioContextRef.current.currentTime);
            } catch (e) {
                // Fallback for older browsers
                try { sourceRef.current.playbackRate.value = playbackRate; } catch (z) {}
            }
        }
    }, [playbackRate]);

    // Handle Book/Chapter Changes - Clear cache so old verses don't play
    useEffect(() => {
        stopAudio();
        setPlaybackRate(1.0);
        audioCacheRef.current = {}; 
    }, [book, chapter, language, version, stopAudio]);

    useEffect(() => {
        try {
            const storedB = localStorage.getItem(BIBLE_BOOKMARKS_KEY);
            if (storedB) setBookmarks(new Set(JSON.parse(storedB)));
            
            const storedH = localStorage.getItem(BIBLE_HIGHLIGHTS_KEY);
            if (storedH) setHighlights(JSON.parse(storedH));
            
            const storedN = localStorage.getItem(BIBLE_NOTES_KEY);
            if (storedN) setNotes(JSON.parse(storedN));
        } catch(e) {}
    }, []);

    const saveNotes = (newNotes: Record<string, string>) => {
        setNotes(newNotes);
        localStorage.setItem(BIBLE_NOTES_KEY, JSON.stringify(newNotes));
    };

    const saveHighlights = (newHighlights: Record<string, string>) => {
        setHighlights(newHighlights);
        localStorage.setItem(BIBLE_HIGHLIGHTS_KEY, JSON.stringify(newHighlights));
    };

    // Save Preference State to Local Storage whenever it changes
    useEffect(() => {
        localStorage.setItem(BIBLE_READER_PREFS_KEY, JSON.stringify({ 
            language, 
            version, 
            book, 
            chapter, 
            compare: isCompareMode, 
            secL: secondaryLanguage, 
            secV: secondaryLanguageVersion 
        }));
    }, [language, version, book, chapter, isCompareMode, secondaryLanguage, secondaryLanguageVersion]);

    const loadData = useCallback(async (lang: BibleLanguage, b: string, c: number, v: string) => {
        const effectiveVersion = lang === 'english' ? v : 'BSI';
        const key = getChapterKey(lang, b, c, effectiveVersion);
        try {
            const result = await fetchBibleChapter(lang, b, c, effectiveVersion);
            if (result.data) {
                setFetchedContent(prev => ({ ...prev, [key]: result.data! }));
                setDataSourceMap(prev => ({ ...prev, [key]: result.source }));
                return result.data;
            } else if (result.source === 'none') {
                setDataSourceMap(prev => ({ ...prev, [key]: 'none' }));
                setFetchedContent(prev => { const n = { ...prev }; delete n[key]; return n; });
            }
        } catch (e: any) { setError(e.message || "An unexpected error occurred."); }
        return null;
    }, []);

    const fetchData = async () => {
        stopAudio(); 
        setIsLoadingContent(true);
        setError(null);
        if (scrollTarget === 'top' && scrollContainerRef.current) { try { scrollContainerRef.current.scrollTop = 0; } catch(e) {} }
        const primaryVersionToUse = language === 'english' ? version : 'BSI';
        await loadData(language, book, chapter, primaryVersionToUse);
        if (isCompareMode) {
            const secondaryVersionToUse = secondaryLanguage === 'english' ? secondaryLanguageVersion : 'BSI';
            await loadData(secondaryLanguage, book, chapter, secondaryVersionToUse);
        }
        setIsLoadingContent(false);
    };

    useEffect(() => { fetchData(); }, [book, chapter, version, language, isCompareMode, secondaryLanguage, secondaryLanguageVersion]);

    const primaryKey = getChapterKey(language, book, chapter, language === 'english' ? version : 'BSI');
    const primaryContent = fetchedContent[primaryKey];
    const primarySource = dataSourceMap[primaryKey];
    const secondaryKey = getChapterKey(secondaryLanguage, book, chapter, secondaryLanguage === 'english' ? secondaryLanguageVersion : 'BSI');
    const secondaryContent = fetchedContent[secondaryKey];
    const verseList = useMemo(() => {
        const set = new Set<number>();
        if (primaryContent) Object.keys(primaryContent).forEach(k => set.add(Number(k)));
        if (isCompareMode && secondaryContent) Object.keys(secondaryContent).forEach(k => set.add(Number(k)));
        return Array.from(set).sort((a: number, b: number) => a - b);
    }, [primaryContent, secondaryContent, isCompareMode]);

    // Audio Buffer Logic
    const getAudioBuffer = async (vNum: number, text: string): Promise<AudioBuffer | null> => {
        if (vNum in audioCacheRef.current) return audioCacheRef.current[vNum];
        const promise = (async () => {
            try {
                if (!audioContextRef.current) {
                     // Use system default sample rate for better Android compatibility
                     const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
                     if (AudioCtor) audioContextRef.current = new AudioCtor();
                     else throw new Error("Audio not supported");
                }
                const base64Audio = await generateSpeech(text);
                if (!base64Audio) return null;
                const bytes = decodeBase64(base64Audio);
                if (!audioContextRef.current || audioContextRef.current.state === 'closed') return null;
                
                // Fixed: Explicitly handle buffer view to prevent potential offset errors
                return await decodePcmToAudioBuffer(bytes, audioContextRef.current, 24000, 1);
            } catch (e) {
                console.error("Audio generation failed", e);
                return null;
            }
        })();
        audioCacheRef.current[vNum] = promise;
        return promise;
    };

    const toggleAudio = async () => {
        if (language !== 'english') return;
        if (isAudioPlaying) { stopAudio(); return; }

        setIsAudioPlaying(true);
        isPlayingRef.current = true;

        try {
            if (!audioContextRef.current) {
                const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtor) audioContextRef.current = new AudioCtor();
            }
            // Ensure context is running (fixes some browser issues)
            if (audioContextRef.current && audioContextRef.current.state !== 'running') {
                await audioContextRef.current.resume();
            }
        } catch (e) {
            console.error("Audio Context Init Error", e);
            stopAudio();
            return;
        }

        const versesToPlay = verseList;
        const playNext = async (index: number) => {
            if (!isPlayingRef.current) return;
            if (index >= versesToPlay.length) { stopAudio(); return; }

            const vNum = versesToPlay[index];
            const text = primaryContent?.[vNum];
            if (!text) { playNext(index + 1); return; }

            // Preload next
            if (index + 1 < versesToPlay.length) {
                const nextVNum = versesToPlay[index + 1];
                const nextText = primaryContent?.[nextVNum];
                if (nextText) getAudioBuffer(nextVNum, nextText);
            }

            setPlayingVerseIndex(vNum);
            const el = document.getElementById(`v-${vNum}`);
            if (el) try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}

            try {
                const buffer = await getAudioBuffer(vNum, text);
                if (!buffer || !isPlayingRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
                     if(isPlayingRef.current) playNext(index + 1); 
                     else stopAudio();
                     return;
                }
                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current.destination);
                
                // IMPORTANT: Set rate using setValueAtTime for immediate effect
                source.playbackRate.setValueAtTime(playbackRateRef.current, audioContextRef.current.currentTime);
                
                source.onended = () => { playNext(index + 1); };
                sourceRef.current = source;
                source.start(0);
            } catch (e) { console.error(e); stopAudio(); }
        };
        playNext(0);
    };

    const handleReferenceClick = useCallback(async (ref: string) => {
        const parsed = parseBibleReference(ref);
        if (!parsed) return;

        setPreviewData({
            refString: ref,
            text: null,
            loading: true,
            targetBook: parsed.book,
            targetChapter: parsed.chapter
        });

        try {
            const effectiveVersion = language === 'english' ? version : 'BSI';
            const result = await fetchBibleChapter(language, parsed.book, parsed.chapter, effectiveVersion);
            if (result.data && parsed.verse) {
                const verseText = toSafeString(result.data[parsed.verse]);
                setPreviewData(prev => prev ? { ...prev, text: verseText, loading: false } : null);
            } else {
                setPreviewData(prev => prev ? { ...prev, text: "Chapter preview loaded. Click to read.", loading: false } : null);
            }
        } catch (e) {
            setPreviewData(prev => prev ? { ...prev, text: "Could not load preview.", loading: false } : null);
        }
    }, [language, version]);

    const handlePreviewNavigate = () => {
        if (previewData?.targetBook && previewData?.targetChapter) {
            setBook(previewData.targetBook);
            setChapter(previewData.targetChapter);
            setSelectedVerses(new Set());
            setScrollTarget('top');
        }
        setPreviewData(null);
    };
    
    const handleVerseClick = (e: React.MouseEvent, verseNum: number) => { 
        e.stopPropagation(); 
        
        // Mobile optimization: Force toolbar to bottom for better UX and to ensure the summary popover (which pops UP) stays on screen
        if (window.innerWidth < 768) {
            setToolbarPosition(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setToolbarPosition({ top: rect.top - 60, left: rect.left + rect.width / 2 });
        }
        
        setSelectionMode('verse');
        setSelectedVerses(prev => { const n = new Set(prev); if (n.has(verseNum)) { n.delete(verseNum); if (n.size === 0) setSelectionMode(null); } else n.add(verseNum); return n; });
    };

    const bookMetadata = useMemo(() => BOOK_METADATA_MAP[book] || BIBLE_METADATA[0], [book]);
    const navigateTo = (e: React.MouseEvent, b: string, c: number) => { e.preventDefault(); setBook(b); setChapter(c); setSelectedVerses(new Set()); setScrollTarget('top'); };
    const getPrevLink = () => {
        const bookIndex = BIBLE_METADATA.findIndex(b => b.en === book);
        if (chapter > 1) return { book, chapter: chapter - 1 };
        else if (bookIndex > 0) { const prevBook = BIBLE_METADATA[bookIndex - 1]; return { book: prevBook.en, chapter: prevBook.chapters }; }
        return null;
    };
    const getNextLink = () => {
        const bookIndex = BIBLE_METADATA.findIndex(b => b.en === book);
        const bookInfo = BIBLE_METADATA[bookIndex];
        if (chapter < bookInfo.chapters) return { book, chapter: chapter + 1 };
        else if (bookIndex < BIBLE_METADATA.length - 1) { const nextBook = BIBLE_METADATA[bookIndex + 1]; return { book: nextBook.en, chapter: 1 }; }
        return null;
    };
    const prevLink = getPrevLink();
    const nextLink = getNextLink();

    const toggleFontSize = () => {
        setFontSizeIndex((prev) => (prev + 1) % fontSizes.length);
    };

    return (
        <div className="bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-300 relative font-sans h-screen flex flex-col w-full overflow-hidden transition-colors duration-500">
            <div className="z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex flex-col transition-all duration-500">
                <div className="flex items-center justify-between px-4 py-1.5 md:px-6">
                    <button onClick={() => setCurrentPage('home')} className="p-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"><HomeIcon className="h-4 w-4 md:h-5 md:w-5" /></button>
                    
                    {/* Compact Title Row & Search */}
                    <div className="flex flex-grow items-center justify-center space-x-2 relative">
                        {showSearch ? (
                            <form 
                                onSubmit={handleExecuteSearch} 
                                className="absolute inset-x-0 bg-white dark:bg-slate-900 p-1 flex items-center shadow-xl rounded-xl z-20 mx-4 border border-amber-500/50"
                            >
                                <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search (e.g. John 3:16)..." className="flex-grow px-4 py-2 bg-transparent text-lg font-serif outline-none text-slate-900 dark:text-white placeholder:text-slate-400" onBlur={() => { if(!searchQuery) setShowSearch(false); }} />
                                <button type="submit" className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-full"><ChevronDownIcon className="h-5 w-5 -rotate-90" /></button>
                                <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-2 text-slate-400 hover:text-slate-500"><XIcon className="h-5 w-5" /></button>
                            </form>
                        ) : (
                            <>
                                <button onClick={() => setShowSearch(true)} className="md:hidden p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><SearchIcon className="h-5 w-5" /></button>
                                <div className="flex items-center space-x-1 md:space-x-3">
                                    <select value={book} onChange={(e) => { setBook(e.target.value); setChapter(1); setSelectedVerses(new Set()); setScrollTarget('top'); }} className="bg-transparent text-slate-900 dark:text-white font-serif font-bold text-lg md:text-xl outline-none cursor-pointer hover:text-amber-500 dark:hover:text-amber-400 transition-colors max-w-[120px] md:max-w-none truncate">
                                        {BIBLE_METADATA.map(b => {
                                            let localName = b.en;
                                            if (language === 'telugu') localName = b.te;
                                            else if (language === 'tamil') localName = b.ta;
                                            else if (language === 'hindi') localName = b.hi || b.en;
                                            else if (language === 'kannada') localName = b.kn || b.en;
                                            else if (language === 'malayalam') localName = b.ml || b.en;
                                            return <option key={b.en} value={b.en} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{localName}</option>;
                                        })}
                                    </select>
                                    <select value={chapter} onChange={(e) => { setChapter(Number(e.target.value)); setSelectedVerses(new Set()); setScrollTarget('top'); }} className="bg-transparent text-amber-600 dark:text-amber-500 font-serif font-bold text-lg md:text-xl outline-none cursor-pointer hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
                                        {Array.from({ length: bookMetadata.chapters }, (_, i) => i + 1).map(c => <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{c}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => setShowSearch(true)} className="hidden md:flex items-center space-x-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 text-xs font-bold transition-all border border-transparent hover:border-amber-500/30">
                                    <SearchIcon className="h-3 w-3" /><span>Jump</span>
                                </button>
                            </>
                        )}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                        <button 
                            onClick={() => setShowOptions(!showOptions)} 
                            className={`p-2 rounded-full transition-all ${showOptions ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            title="Bible Options"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Download Notification Banner */}
                <AnimatePresence>
                    {showDownloadPrompt && !isLoadingContent && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-amber-500/10 border-t border-slate-200 dark:border-white/5 px-4 py-2 flex items-center justify-between"
                        >
                            <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400">
                                <DownloadIcon className="h-3.5 w-3.5" />
                                <span className="text-[10px] md:text-xs font-medium">
                                    Read offline: Download {language === 'english' ? version : language.toUpperCase()} version.
                                </span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button 
                                    onClick={() => setShowDownloadModal(true)}
                                    className="text-[9px] font-black uppercase bg-amber-500 text-white px-3 py-1 rounded-full hover:bg-amber-600 transition-colors shadow-sm"
                                >
                                    Download
                                </button>
                                <button 
                                    onClick={() => {
                                        const targetVersion = language === 'english' ? version : 'BSI';
                                        sessionStorage.setItem(`dismiss_download_${language}_${targetVersion}`, 'true');
                                        setShowDownloadPrompt(false);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Collapsible Options Bar */}
                <AnimatePresence>
                    {showOptions && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-white/5"
                        >
                            <div className="px-4 py-3 flex flex-wrap gap-4 items-center justify-center">
                                <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-white/10">
                                    <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-slate-500 dark:text-slate-400 text-[10px] font-black px-2 py-1 outline-none uppercase tracking-tighter">
                                        <option value="english">EN</option><option value="telugu">TE</option><option value="tamil">TA</option><option value="hindi">HI</option><option value="kannada">KN</option><option value="malayalam">ML</option>
                                    </select>
                                    {language === 'english' && (
                                        <select value={version} onChange={(e) => setVersion(e.target.value as any)} className="bg-transparent text-amber-600 dark:text-amber-500 text-[10px] font-black px-2 py-1 outline-none uppercase tracking-tighter">
                                            {['KJV', 'NKJV', 'ESV', 'NASB', 'NIV', 'NLT', 'AMP', 'ASV', 'AKJV', 'EHV'].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button onClick={toggleFontSize} className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-colors" title="Font Size"><TextSizeIcon className="h-4 w-4" /></button>
                                    <button onClick={() => setShowDownloadModal(true)} className={`p-2 rounded-lg border transition-all ${isOfflineReady ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-500'}`} title="Offline"><DownloadIcon className="h-4 w-4" /></button>
                                    <button onClick={() => setIsCompareMode(!isCompareMode)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all ${isCompareMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-white/10'}`} title="Compare Versions">
                                        <ViewColumnsIcon className="h-4 w-4" /><span className="text-[9px] font-black uppercase">Compare</span>
                                    </button>
                                </div>

                                {language === 'english' && !isLoadingContent && verseList.length > 0 && (
                                    <div className={`flex items-center rounded-lg transition-all border ${isAudioPlaying ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-500'}`}>
                                        <button onClick={toggleAudio} className="p-2" title="Listen">
                                            {isAudioPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 ml-0.5" />}
                                        </button>
                                        <select value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} className="bg-transparent text-[10px] font-bold outline-none cursor-pointer appearance-none py-1 px-2">
                                            <option value="0.5">0.5x</option><option value="1.0">1.0x</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {isCompareMode && (
                                <div className="px-4 py-2 flex items-center justify-center space-x-3 border-t border-slate-200 dark:border-white/5 bg-slate-200/30 dark:bg-slate-950/30">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Compare With:</span>
                                    <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-white/10">
                                        <select value={secondaryLanguage} onChange={(e) => setSecondaryLanguage(e.target.value as any)} className="bg-transparent text-slate-500 dark:text-slate-400 text-[10px] font-black px-2 py-1 outline-none uppercase tracking-tighter">
                                            <option value="english">EN</option><option value="telugu">TE</option><option value="tamil">TA</option><option value="hindi">HI</option><option value="kannada">KN</option><option value="malayalam">ML</option>
                                        </select>
                                        {secondaryLanguage === 'english' && (
                                            <select value={secondaryLanguageVersion} onChange={(e) => setSecondaryVersion(e.target.value as any)} className="bg-transparent text-amber-600 dark:text-amber-500 text-[10px] font-black px-2 py-1 outline-none uppercase tracking-tighter">
                                                {['KJV', 'NKJV', 'ESV', 'NASB', 'NIV', 'NLT', 'AMP', 'ASV', 'AKJV', 'EHV'].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Offline Promotion Banner */}
            {!isOfflineReady && !isLoadingContent && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between animate-fadeIn relative z-20">
                    <span className="text-xs text-amber-500 font-bold uppercase tracking-wide truncate pr-2">
                        Reading Online. Download {language === 'english' ? version : language.charAt(0).toUpperCase() + language.slice(1)} for offline use?
                    </span>
                    <button onClick={() => setShowDownloadModal(true)} className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap">
                        <DownloadIcon className="h-3 w-3" /><span>Download Now</span>
                    </button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                <article ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 pb-40 transition-colors duration-500">
                    {isLoadingContent ? (
                        <div className="max-w-4xl mx-auto p-4 space-y-2">
                            {Array.from({ length: 12 }).map((_, i) => <SkeletonVerseRow key={i} />)}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div className="bg-red-50 dark:bg-red-500/10 p-6 rounded-2xl border border-red-200 dark:border-red-500/30 max-w-md">
                                <h3 className="text-red-500 dark:text-red-400 font-bold mb-2">Unavailable</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
                                <button onClick={fetchData} className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-300 rounded-lg text-sm font-bold transition-colors">Retry Connection</button>
                            </div>
                        </div>
                    ) : (
                        <div className={isCompareMode ? 'w-full' : 'max-w-4xl mx-auto px-4 py-8 md:px-12'}>
                            {verseList.length > 0 ? (
                                verseList.map(vNum => {
                                    const t1 = primaryContent?.[vNum];
                                    const t2 = isCompareMode ? secondaryContent?.[vNum] : undefined;
                                    if (isCompareMode) {
                                        return (
                                            <ParallelVerseRow 
                                                key={vNum} verseNum={vNum} text1={t1} text2={t2} lang1={language} lang2={secondaryLanguage}
                                                isSelected={selectedVerses.has(vNum)} 
                                                highlightColor={highlights[`${book} ${chapter}:${vNum}`]}
                                                hasNote={!!notes[`${book} ${chapter}:${vNum}`]}
                                                onSelect={handleVerseClick} onRefClick={handleReferenceClick}
                                                fontSizeClass={fontSizes[fontSizeIndex]}
                                            />
                                        );
                                    }
                                    return (
                                        <VerseRow 
                                            key={vNum} verseNum={vNum} text={t1} language={language}
                                            isSelected={selectedVerses.has(vNum)}
                                            isPlaying={playingVerseIndex === vNum}
                                            hasBookmark={bookmarks.has(`${book} ${chapter}:${vNum}`)}
                                            highlightColor={highlights[`${book} ${chapter}:${vNum}`]}
                                            hasNote={!!notes[`${book} ${chapter}:${vNum}`]}
                                            onSelect={handleVerseClick}
                                            onRefClick={handleReferenceClick}
                                            fontSizeClass={fontSizes[fontSizeIndex]}
                                        />
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                                    <p className="text-lg font-serif text-slate-400">Bible data not available for the selected language.</p>
                                    <button onClick={fetchData} className="text-amber-500 text-sm hover:underline">Retry</button>
                                </div>
                            )}
                            {/* Navigation Links */}
                            <div className="mt-16 mb-12 flex justify-between items-center px-4 max-w-2xl mx-auto border-t border-slate-200 dark:border-white/5 pt-10">
                                {prevLink ? (
                                    <a href={`/?page=bible&book=${prevLink.book}&chapter=${prevLink.chapter}`} onClick={(e) => navigateTo(e, prevLink.book, prevLink.chapter)} className="flex flex-col items-start space-y-2 transition-all group hover:text-amber-500">
                                        <div className="flex items-center space-x-2"><ChevronDownIcon className="h-4 w-4 rotate-90" /><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-500">Back</span></div>
                                        <span className="text-sm font-serif font-bold text-slate-400 dark:text-slate-500">Chapter {prevLink.chapter}</span>
                                    </a>
                                ) : <div className="opacity-10 cursor-not-allowed flex flex-col items-start space-y-2"><div className="flex items-center space-x-2"><ChevronDownIcon className="h-4 w-4 rotate-90" /><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600">Back</span></div></div>}
                                <div className="h-10 w-px bg-slate-200 dark:bg-white/5"></div>
                                {nextLink ? (
                                    <a href={`/?page=bible&book=${nextLink.book}&chapter=${nextLink.chapter}`} onClick={(e) => navigateTo(e, nextLink.book, nextLink.chapter)} className="flex flex-col items-end space-y-2 transition-all group hover:text-amber-500">
                                        <div className="flex items-center space-x-2"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-500">Next</span><ChevronDownIcon className="h-4 w-4 -rotate-90" /></div>
                                        <span className="text-sm font-serif font-bold text-slate-400 dark:text-slate-500">Chapter {nextLink.chapter}</span>
                                    </a>
                                ) : <div className="opacity-10 cursor-not-allowed flex flex-col items-end space-y-2"><div className="flex items-center space-x-2"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600">Next</span><ChevronDownIcon className="h-4 w-4 -rotate-90" /></div></div>}
                            </div>
                        </div>
                    )}
                </article>

                {/* Integrated Insight Panel (Side Panel) */}
                {showInsightPanel && sortedSelectedVerses.length > 0 && (
                    <div className="hidden lg:block w-96 h-full border-l border-slate-200 dark:border-white/10 animate-fadeInRight">
                        <VerseInsightPanel 
                            verseText={isCompareMode 
                                ? `${toSafeString(primaryContent?.[sortedSelectedVerses[0]])} | ${toSafeString(secondaryContent?.[sortedSelectedVerses[0]])}` 
                                : toSafeString(primaryContent?.[sortedSelectedVerses[0]]) || ''
                            } 
                            reference={`${book} ${chapter}:${sortedSelectedVerses[0]}`} 
                            language={isCompareMode && language !== secondaryLanguage ? `${language} and ${secondaryLanguage}` : language} 
                            onClose={() => setShowInsightPanel(false)}
                            onRefClick={handleReferenceClick}
                        />
                    </div>
                )}
            </div>

            {/* Reference Preview Modal */}
            <ReferencePreviewModal data={previewData} onClose={() => setPreviewData(null)} onNavigate={handlePreviewNavigate} />
            {/* Download Modal */}
            {showDownloadModal && <DownloadModal onClose={() => setShowDownloadModal(false)} onDownloadComplete={checkOfflineStatus} />}
            
            {/* Selection Toolbar - Fixed to bottom on Mobile for better visibility/UX */}
            {(selectionMode === 'verse' || selectedVerses.size > 0) && (
                <div 
                    className="fixed z-[9999] pointer-events-auto transition-all duration-300 animate-fadeInUp md:absolute" 
                    style={{ 
                        // On Desktop, follow mouse click. On Mobile (screen < 768px), stick to bottom.
                        ...(window.innerWidth >= 768 ? {
                            top: toolbarPosition ? Math.max(120, toolbarPosition.top) : 'auto', 
                            bottom: toolbarPosition ? 'auto' : '2rem', 
                            left: toolbarPosition ? toolbarPosition.left : '50%', 
                            transform: 'translateX(-50%)',
                            width: 'auto'
                        } : {
                            top: 'auto',
                            bottom: '6rem', // Moved up to avoid overlap with NavigationDock
                            left: '0',
                            right: '0',
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center'
                        })
                    }}
                >
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/30 shadow-2xl rounded-2xl px-3 md:px-6 py-2.5 flex items-center space-x-3 md:space-x-4 ring-1 ring-black/5 dark:ring-white/10 mx-4 max-w-[95vw] md:max-w-xl overflow-x-auto no-scrollbar">
                        <button onClick={() => {
                            const textToCopy = sortedSelectedVerses.map(v => `${v}. ${primaryContent?.[v]}`).join('\n');
                            navigator.clipboard.writeText(`${book} ${chapter}\n${textToCopy}`).then(() => alert('Copied to clipboard!'));
                        }} title="Copy" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <CopyIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>
                        
                        <button onClick={() => setShowSharePopover(true)} title="Share" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <ShareIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>

                        <button onClick={() => {
                            const firstSelected = sortedSelectedVerses[0];
                            const ref = `${book} ${chapter}:${firstSelected}`;
                            setBookmarks(prev => { const n = new Set(prev); if (n.has(ref)) n.delete(ref); else n.add(ref); localStorage.setItem(BIBLE_BOOKMARKS_KEY, JSON.stringify(Array.from(n))); return n; });
                        }} title="Bookmark" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <BookmarkIcon filled={bookmarks.has(`${book} ${chapter}:${sortedSelectedVerses[0]}`)} className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
                        </button>

                        <button onClick={() => setShowNoteModal(true)} title="Add Note" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <NoteIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-amber-500" />
                        </button>

                        <button onClick={() => {
                            if (onCreateImage && sortedSelectedVerses.length > 0) {
                                const text = sortedSelectedVerses.map(v => primaryContent?.[v]).join(' ');
                                const ref = `${book} ${chapter}:${sortedSelectedVerses.join(',')}`;
                                onCreateImage(text, ref);
                            }
                        }} title="Create Image" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <SparklesIcon className="h-5 w-5 text-amber-500" />
                        </button>

                        <div className="relative">
                            <button onClick={() => setShowColorPicker(!showColorPicker)} title="Highlight" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                                <HighlightIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-amber-500" />
                            </button>
                            {showColorPicker && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 flex space-x-2 shadow-xl z-50">
                                    {['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'].map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => {
                                                const newHighlights = { ...highlights };
                                                sortedSelectedVerses.forEach(v => {
                                                    const ref = `${book} ${chapter}:${v}`;
                                                    newHighlights[ref] = color;
                                                });
                                                saveHighlights(newHighlights);
                                                setShowColorPicker(false);
                                            }}
                                            className="w-6 h-6 rounded-full border border-white/20"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const newHighlights = { ...highlights };
                                            sortedSelectedVerses.forEach(v => {
                                                const ref = `${book} ${chapter}:${v}`;
                                                delete newHighlights[ref];
                                            });
                                            saveHighlights(newHighlights);
                                            setShowColorPicker(false);
                                        }}
                                        className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] text-slate-500"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                        
                        <button onClick={() => {
                            if (window.innerWidth >= 1024) {
                                setShowInsightPanel(true);
                                setShowSummaryModal(false);
                            } else {
                                setShowSummaryModal(true);
                            }
                        }} title="AI Insight" className="flex items-center space-x-2 group px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                            <SparklesIcon className={`h-4 w-4 transition-colors ${showSummaryModal || showInsightPanel ? 'text-amber-500 dark:text-amber-300' : 'text-amber-600 dark:text-amber-500 group-hover:text-amber-400'}`} />
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 group-hover:text-amber-400 uppercase tracking-widest">Explain</span>
                        </button>
                        
                        <button onClick={() => { setSelectedVerses(new Set()); setSelectionMode(null); setShowSummaryModal(false); setShowInsightPanel(false); setToolbarPosition(null); setShowColorPicker(false); }} className="p-2 hover:bg-red-500/10 rounded-xl transition-colors"><XIcon className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>
                    </div>
                </div>
            )}
            
            {/* Note Modal */}
            {showNoteModal && sortedSelectedVerses.length > 0 && (
                <NoteModal 
                    verseRef={`${book} ${chapter}:${sortedSelectedVerses[0]}`}
                    initialNote={notes[`${book} ${chapter}:${sortedSelectedVerses[0]}`] || ''}
                    onSave={(ref, text) => {
                        const newNotes = { ...notes };
                        if (text.trim()) newNotes[ref] = text;
                        else delete newNotes[ref];
                        saveNotes(newNotes);
                        setShowNoteModal(false);
                    }}
                    onClose={() => setShowNoteModal(false)}
                />
            )}
            
            {/* AI Summary Modal - Using Portal, so just render it based on state */}
            {showSummaryModal && sortedSelectedVerses.length > 0 && (
                <VerseSummaryModal 
                    verseText={isCompareMode 
                        ? `${toSafeString(primaryContent?.[sortedSelectedVerses[0]])} | ${toSafeString(secondaryContent?.[sortedSelectedVerses[0]])}` 
                        : toSafeString(primaryContent?.[sortedSelectedVerses[0]]) || ''
                    } 
                    reference={`${book} ${chapter}:${sortedSelectedVerses[0]}`} 
                    language={isCompareMode && language !== secondaryLanguage ? `${language} and ${secondaryLanguage}` : language} 
                    onClose={() => setShowSummaryModal(false)} 
                />
            )}
            
            {/* Share Popover */}
            {showSharePopover && sortedSelectedVerses.length > 0 && (
                <BibleSharePopover 
                    verses={sortedSelectedVerses.map(v => ({ num: v, text: primaryContent?.[v] || '' }))} 
                    book={book} 
                    chapter={chapter} 
                    version={language === 'english' ? version : language.toUpperCase()} 
                    onClose={() => { setShowSharePopover(false); setSelectedVerses(new Set()); setSelectionMode(null); }} 
                />
            )}
        </div>
    );
};

export default BibleReader;
