
import React, { useState, useEffect } from 'react';
import { generateVerseSummary } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import XIcon from './icons/XIcon';
import LinkIcon from './icons/LinkIcon';

interface CrossReference {
    ref: string;
    text: string;
}

interface SummaryData {
    key_word: string;
    summary: string;
    cross_references: CrossReference[];
}

interface VerseInsightPanelProps {
  verseText: string;
  reference: string;
  language: string;
  onClose: () => void;
  onRefClick: (ref: string) => void;
}

const VerseInsightPanel: React.FC<VerseInsightPanelProps> = ({ verseText, reference, language, onClose, onRefClick }) => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
        if (!reference) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const result = await generateVerseSummary(verseText, reference, language);
            if (isMounted) {
                if (result) {
                    setData(result);
                } else {
                    setErrorMsg("AI service temporarily unavailable.");
                }
            }
        } catch (e) {
            console.error(e);
            if (isMounted) setErrorMsg("Failed to generate insight.");
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };
    fetchSummary();
    return () => { isMounted = false; };
  }, [verseText, reference, language]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md border-l border-slate-700/50 animate-fadeIn">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <div className="flex items-center">
                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 mr-2">
                    <SparklesIcon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold font-serif text-slate-200">Insight: {reference}</h2>
            </div>
            <button 
                onClick={onClose} 
                className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
            >
                <XIcon className="h-5 w-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {isLoading ? (
                 <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-amber-500"></div>
                        <div className="absolute inset-0 m-auto h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">Analyzing Scripture...</p>
                 </div>
            ) : errorMsg ? (
                 <div className="text-center py-6 bg-red-500/5 rounded-xl border border-red-500/20">
                    <p className="text-red-400 text-xs font-bold mb-3">{errorMsg}</p>
                    <button 
                        onClick={() => { 
                            setIsLoading(true); 
                            setErrorMsg(null); 
                            generateVerseSummary(verseText, reference, language).then(r => { 
                                if (r) {
                                    setData(r);
                                    setIsLoading(false);
                                } else {
                                    setErrorMsg('Retry failed.');
                                    setIsLoading(false);
                                }
                            }); 
                        }} 
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
                    >
                        Retry
                    </button>
                 </div>
            ) : data ? (
                <div className="space-y-8">
                    <div className="flex justify-center">
                        <div className="inline-flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Key Theme</span>
                            <span className="px-5 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                {data.key_word}
                            </span>
                        </div>
                    </div>
                    
                    <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50 relative">
                        <div className="absolute -top-3 left-4 px-2 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Summary</div>
                        <p className="text-slate-300 text-sm leading-relaxed font-medium italic">
                            "{data.summary}"
                        </p>
                    </div>
                    
                    {data.cross_references && data.cross_references.length > 0 && (
                        <div className="pt-2">
                            <div className="flex items-center mb-4">
                                <LinkIcon className="h-3 w-3 text-amber-500 mr-2" />
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Cross References</span>
                            </div>
                            <div className="space-y-3">
                                {data.cross_references.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => onRefClick(item.ref)}
                                        className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-amber-500 text-xs font-bold uppercase tracking-wide group-hover:text-amber-400">{item.ref}</span>
                                            <LinkIcon className="h-3 w-3 text-slate-600 group-hover:text-amber-500 transition-colors" />
                                        </div>
                                        <p className="text-xs text-slate-400 italic font-serif leading-relaxed line-clamp-3">"{item.text}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    </div>
  );
};

export default VerseInsightPanel;
