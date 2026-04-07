
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Page } from '../types';
import FloatingChatWidget from './FloatingChatWidget';
import FeatureDiscoveryGuide from './FeatureDiscoveryGuide';
import FlightIcon from './icons/FlightIcon';
import CompassIcon from './icons/CompassIcon';
import SparklesIcon from './icons/SparklesIcon';
import XIcon from './icons/XIcon';

interface FloatingActionStackProps {
    setCurrentPage: (page: Page) => void;
    currentPage: Page;
}

const FloatingActionStack: React.FC<FloatingActionStackProps> = ({ setCurrentPage, currentPage }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Junia Animation State
    const [showJuniaGreeting, setShowJuniaGreeting] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    
    // Listen for header event
    useEffect(() => {
        const handleOpen = () => {
            setIsExpanded(true);
            setIsChatOpen(true);
        };
        window.addEventListener('open-junia-chat', handleOpen);
        return () => window.removeEventListener('open-junia-chat', handleOpen);
    }, []);

    useEffect(() => {
        if (isDismissed || !isExpanded) return;

        // Show greeting every 12 seconds if expanded
        const cycleDuration = 12000; 
        const visibleDuration = 5000; 

        const interval = setInterval(() => {
            if (!isChatOpen && !isDismissed && isExpanded) {
                setShowJuniaGreeting(true);
                setTimeout(() => {
                    setShowJuniaGreeting(false); 
                }, visibleDuration);
            }
        }, cycleDuration);

        return () => clearInterval(interval);
    }, [isChatOpen, isDismissed, isExpanded]);

    const handleFlightClick = () => {
        if (currentPage !== 'home') {
            setCurrentPage('home');
            setTimeout(() => {
                const el = document.getElementById('discover-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        } else {
            const el = document.getElementById('discover-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleDismissGreeting = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
        setShowJuniaGreeting(false);
    };
    
    return (
        <>
            {/* The Floating Stack - Bottom Right */}
            <div className="fixed bottom-24 right-4 z-[90] flex flex-col items-end gap-3 pointer-events-none">
                
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.8 }}
                            className="flex flex-col items-end gap-3 mb-2"
                        >
                            {/* 1. FLIGHT BUTTON */}
                            <button 
                                onClick={handleFlightClick}
                                className="pointer-events-auto group relative w-12 h-12 flex items-center justify-center bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-full shadow-lg hover:shadow-amber-500/20 hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                                title="Discover True Harvest"
                            >
                                <div className="text-white transform -rotate-45 group-hover:rotate-0 transition-transform duration-500">
                                    <FlightIcon className="h-5 w-5" />
                                </div>
                                <div className="absolute right-full mr-3 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
                                    Discover
                                </div>
                            </button>

                            {/* 2. DOUBTS BUTTON */}
                            <button 
                                onClick={() => setIsGuideOpen(true)}
                                className="pointer-events-auto group relative w-12 h-12 flex items-center justify-center bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-full shadow-lg hover:shadow-amber-500/20 hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                                title="Still Doubts?"
                            >
                                <div className="text-amber-500 group-hover:animate-[spin_4s_linear_infinite]">
                                    <CompassIcon className="h-5 w-5" />
                                </div>
                                <div className="absolute right-full mr-3 bg-slate-900 text-amber-500 text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-amber-500/20 pointer-events-none">
                                    Still Doubts?
                                </div>
                            </button>

                            {/* 3. JUNIA BUTTON */}
                            <div className="relative pointer-events-auto flex items-end">
                                {/* Greeting Bubble */}
                                <AnimatePresence>
                                    {showJuniaGreeting && !isChatOpen && !isDismissed && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                            className="absolute bottom-full right-0 mb-4 w-60 bg-white text-slate-900 p-4 rounded-2xl rounded-br-none shadow-2xl z-20 border border-amber-500/20 origin-bottom-right"
                                        >
                                            <button 
                                                onClick={handleDismissGreeting}
                                                className="absolute -top-2 -right-2 bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-full p-1 shadow-md transition-colors"
                                            >
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl animate-bounce mt-1">👋</span>
                                                <p className="text-xs font-bold leading-relaxed text-left text-slate-800">
                                                    Hello Beloved in Christ, I am Junia, I am here to help you!
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button 
                                    onClick={() => setIsChatOpen(!isChatOpen)}
                                    className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 relative ${
                                        isChatOpen 
                                        ? 'bg-slate-700 border-slate-600 rotate-90 text-white' 
                                        : 'bg-amber-100 border-amber-500'
                                    }`}
                                >
                                    {isChatOpen ? (
                                        <XIcon className="h-6 w-6" />
                                    ) : (
                                        <div className="relative w-full h-full rounded-full flex items-center justify-center bg-amber-50 text-3xl">
                                            <div className="transform translate-y-0.5">👸</div>
                                            <div className="absolute bottom-0 right-0 z-20 animate-[wave_2s_infinite] origin-bottom-right text-sm drop-shadow-sm">
                                                👋
                                            </div>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Trigger Button */}
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`pointer-events-auto w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-500 border-2 ${
                        isExpanded 
                        ? 'bg-slate-950 border-amber-500 text-amber-500 rotate-180' 
                        : 'bg-slate-900 border-white/20 text-white hover:border-amber-500/50'
                    }`}
                >
                    {isExpanded ? (
                        <XIcon className="h-5 w-5" />
                    ) : (
                        <SparklesIcon className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* Render Windows */}
            <FloatingChatWidget isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />
            
            <FeatureDiscoveryGuide 
                isOpen={isGuideOpen} 
                onClose={() => setIsGuideOpen(false)}
                setCurrentPage={setCurrentPage} 
                onOpenChat={() => { setIsGuideOpen(false); setIsChatOpen(true); }} 
            />
            
            {/* Styles for wave animation */}
            <style>{`
                @keyframes wave {
                    0% { transform: rotate(0deg); }
                    20% { transform: rotate(14deg); }
                    40% { transform: rotate(-8deg); }
                    60% { transform: rotate(14deg); }
                    80% { transform: rotate(-4deg); }
                    100% { transform: rotate(10deg); }
                }
            `}</style>
        </>
    );
};

export default FloatingActionStack;
