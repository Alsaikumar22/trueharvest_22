
import React from 'react';
import type { Page, User } from '../types';
import Logo from './Logo';
import UserIcon from './icons/UserIcon';
import LogoutIcon from './icons/LogoutIcon';
import ChatIcon from './icons/ChatIcon';

interface HeaderProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ setCurrentPage, currentUser, onLogout, onOpenChat }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
      {/* 
          Backdrop with Safe Area Support 
          We separate the visual background from the layout container to ensure proper blurring 
      */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg border-b border-white/10 shadow-lg shadow-black/20"></div>
      
      {/* Content Container with Safe Area Padding */}
      <div className="relative z-50 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          
            {/* Logo and Brand */}
            <button 
                onClick={() => setCurrentPage('home')} 
                className="flex items-center group focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg p-1 -ml-1"
                aria-label="Go to Home"
            >
              <Logo svgClassName="w-9 h-9 md:w-10 md:h-10 text-amber-500 dark:text-amber-400" rootClassName="text-white" />
            </button>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Ask Junia Button - High Visibility */}
            <button 
                onClick={onOpenChat}
                className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 border border-indigo-400/30 group"
            >
                <ChatIcon className="h-4 w-4 md:h-5 md:w-5 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline">Ask Junia 👧</span>
            </button>

            {currentUser ? (
              <div className="flex items-center bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-full p-1 pl-1 pr-1 shadow-sm">
                 <button 
                    onClick={() => setCurrentPage('profile')}
                    className="flex items-center gap-2 pl-3 pr-2 h-10 rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
                    title="Profile"
                 >
                    <span className="text-xs font-bold text-slate-200 hidden sm:inline uppercase tracking-widest max-w-[100px] truncate">
                        {currentUser.profile?.displayName?.split(' ')[0] || 'Member'}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 shadow-sm">
                        <UserIcon className="h-5 w-5" />
                    </div>
                 </button>
                 
                 <div className="w-px h-6 bg-white/10 mx-1"></div>

                 <button 
                    onClick={onLogout}
                    className="h-10 w-10 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-900/20 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Logout"
                 >
                    <LogoutIcon className="h-5 w-5" />
                 </button>
              </div>
            ) : (
              <button 
                onClick={onLogout}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Join
              </button>
            )}
          </div>
      </div>
    </header>
  );
};

export default Header;
