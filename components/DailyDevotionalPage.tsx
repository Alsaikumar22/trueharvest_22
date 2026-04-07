
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { getDailyDevotional } from '../services/geminiService';
import type { DailyDevotional, Page } from '../types';
import Logo from './Logo';

interface DailyDevotionalPageProps {
    setCurrentPage: (page: Page) => void;
}

const DailyDevotionalPage: React.FC<DailyDevotionalPageProps> = ({ setCurrentPage }) => {
    const [devotional, setDevotional] = useState<DailyDevotional | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDevotional = async () => {
            setIsLoading(true);
            try {
                const data = await getDailyDevotional();
                if (data) {
                    setDevotional(data);
                } else {
                    setError("Could not generate devotional. Please try again later.");
                }
            } catch (err) {
                setError("An error occurred while fetching the devotional.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDevotional();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <Logo svgClassName="w-16 h-16 text-amber-400 relative z-10" showText={false} />
                </div>
                <p className="text-slate-400 animate-pulse font-serif italic">Preparing your daily bread...</p>
            </div>
        );
    }

    if (error || !devotional) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-red-500/10 p-4 rounded-full mb-4 border border-red-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
                <p className="text-slate-400 mb-6 max-w-md">{error || "We couldn't load today's devotional."}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
        >
            {/* Header Section */}
            <div className="text-center mb-10">
                <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">
                    Daily Devotional • {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white font-serif mb-4 leading-tight">
                    {devotional.title}
                </h1>
                <div className="w-24 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto"></div>
            </div>

            {/* Scripture Card */}
            <div className="relative mb-12 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
                    <div className="absolute top-0 left-8 -translate-y-1/2 bg-amber-500 text-slate-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-tighter">
                        The Word
                    </div>
                    <blockquote className="text-xl md:text-2xl text-slate-200 font-serif italic leading-relaxed mb-6">
                        "{devotional.verse}"
                    </blockquote>
                    <div className="flex justify-end items-center space-x-2">
                        <div className="h-px w-8 bg-slate-700"></div>
                        <span className="text-amber-400 font-bold tracking-wide">{devotional.reference}</span>
                    </div>
                </div>
            </div>

            {/* Meditation Content */}
            <div className="space-y-6 mb-12">
                <div className="flex items-center space-x-4 mb-2">
                    <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Meditation</h2>
                </div>
                <div className="text-slate-300 text-lg leading-relaxed font-serif space-y-4 whitespace-pre-wrap">
                    {devotional.meditation}
                </div>
            </div>

            {/* Prayer Section */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-8 rounded-2xl mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                    </svg>
                </div>
                <h3 className="text-amber-400 font-bold uppercase tracking-widest text-sm mb-4">A Prayer for Today</h3>
                <p className="text-slate-200 text-xl italic font-serif leading-relaxed">
                    "{devotional.prayer}"
                </p>
            </div>

            {/* Thought for the Day */}
            <div className="border-t border-slate-800 pt-8 mb-16">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <h4 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Thought for the Day</h4>
                        <p className="text-white text-lg font-medium">
                            {devotional.thought}
                        </p>
                    </div>
                    <button 
                        onClick={() => setCurrentPage('bible')}
                        className="flex items-center space-x-2 text-amber-500 hover:text-amber-400 font-bold transition-colors group"
                    >
                        <span>Read More in Bible</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default DailyDevotionalPage;
