
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    subscribeToPrayerRequests, 
    addPrayerRequest, 
    prayForRequest 
} from '../services/firebaseService';
import type { PrayerRequest, User, Page } from '../types';
import { formatDistanceToNow } from 'date-fns';
import Logo from './Logo';

interface PrayerWallProps {
    user: User | null;
    setCurrentPage: (page: Page) => void;
}

const PrayerWall: React.FC<PrayerWallProps> = ({ user, setCurrentPage }) => {
    const [requests, setRequests] = useState<PrayerRequest[]>([]);
    const [newRequest, setNewRequest] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToPrayerRequests(setRequests);
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newRequest.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await addPrayerRequest({
                userId: user.email,
                userName: isAnonymous ? 'Anonymous' : (user.profile?.displayName || user.email.split('@')[0]),
                userAvatar: isAnonymous ? 'bg-slate-700' : (user.profile?.avatar || 'bg-amber-500'),
                request: newRequest.trim(),
                timestamp: new Date().toISOString(),
                isAnonymous,
                prayCount: 0,
                prayers: []
            });
            setNewRequest('');
            setShowForm(false);
        } catch (error) {
            console.error("Error submitting prayer request:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePray = async (requestId: string) => {
        if (!user) return;
        try {
            await prayForRequest(requestId, user.email);
        } catch (error) {
            console.error("Error praying for request:", error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                <div>
                    <h1 className="text-4xl font-serif font-bold text-white mb-2">Prayer Wall</h1>
                    <p className="text-slate-400 italic">"Carry each other’s burdens, and in this way you will fulfill the law of Christ." — Galatians 6:2</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>Submit Request</span>
                </button>
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-12"
                    >
                        <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl">
                            <h2 className="text-xl font-bold text-white mb-4">Share your burden</h2>
                            <textarea 
                                value={newRequest}
                                onChange={(e) => setNewRequest(e.target.value)}
                                placeholder="How can we pray for you today?"
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-[150px] mb-4"
                                required
                            />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isAnonymous ? 'bg-amber-500 border-amber-500' : 'border-slate-700 group-hover:border-slate-500'}`}>
                                        {isAnonymous && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={isAnonymous}
                                        onChange={() => setIsAnonymous(!isAnonymous)}
                                    />
                                    <span className="text-slate-300 text-sm font-medium">Post anonymously</span>
                                </label>
                                <div className="flex space-x-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting || !newRequest.trim()}
                                        className="px-8 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-full transition-all"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Post Request'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-6">
                {requests.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                        <div className="mb-4 flex justify-center">
                            <Logo svgClassName="w-12 h-12 text-slate-700" showText={false} />
                        </div>
                        <p className="text-slate-500">No prayer requests yet. Be the first to share.</p>
                    </div>
                ) : (
                    requests.map((req) => (
                        <motion.div 
                            key={req.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-6 md:p-8 hover:border-amber-500/30 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-12 h-12 rounded-2xl ${req.userAvatar || 'bg-amber-500'} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                                        {req.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">{req.userName}</h3>
                                        <p className="text-slate-500 text-xs uppercase tracking-widest">
                                            {formatDistanceToNow(new Date(req.timestamp), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                                    <span className="text-amber-500 font-bold text-sm">{req.prayCount || 0}</span>
                                    <span className="text-slate-500 text-xs uppercase font-bold tracking-tighter">Prayers</span>
                                </div>
                            </div>
                            
                            <p className="text-slate-200 text-lg leading-relaxed font-serif mb-8 whitespace-pre-wrap">
                                {req.request}
                            </p>

                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => handlePray(req.id)}
                                    disabled={!user || (req.prayers && req.prayers.includes(user.email))}
                                    className={`flex items-center space-x-2 px-6 py-2 rounded-full transition-all font-bold text-sm ${
                                        user && req.prayers && req.prayers.includes(user.email)
                                            ? 'bg-amber-500/20 text-amber-500 cursor-default'
                                            : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300'
                                    }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                    </svg>
                                    <span>{user && req.prayers && req.prayers.includes(user.email) ? 'I Prayed' : 'I Will Pray'}</span>
                                </button>

                                {req.prayCount > 0 && (
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {[...Array(Math.min(req.prayCount, 3))].map((_, i) => (
                                            <div key={i} className={`inline-block h-6 w-6 rounded-full ring-2 ring-slate-900 bg-amber-500/50 border border-amber-500/20 flex items-center justify-center`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PrayerWall;
