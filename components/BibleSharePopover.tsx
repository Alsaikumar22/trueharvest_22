
import React from 'react';
import { createPortal } from 'react-dom';
import FacebookIcon from './icons/FacebookIcon';
import TwitterIcon from './icons/TwitterIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import CopyIcon from './icons/CopyIcon';
import GmailIcon from './icons/GmailIcon';
import ThreadsIcon from './icons/ThreadsIcon';
import LinkIcon from './icons/LinkIcon';
import InstagramIcon from './icons/InstagramIcon';
import SnapchatIcon from './icons/SnapchatIcon';

interface BibleSharePopoverProps {
  verses: { num: number; text: string }[];
  book: string;
  chapter: number;
  version: string;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

const BibleSharePopover: React.FC<BibleSharePopoverProps> = ({ verses, book, chapter, version, onClose, position = 'top' }) => {
  // Format the reference string (e.g., John 3:16 or John 3:16-18)
  const formatReference = (): string => {
    if (verses.length === 0) return `${book} ${chapter}`;
    if (verses.length === 1) return `${book} ${chapter}:${verses[0].num}`;
    
    const sortedNums = verses.map(v => v.num).sort((a, b) => a - b);
    return `${book} ${chapter}:${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}`;
  };

  const generateDeepLink = (): string => {
     const params = new URLSearchParams();
     params.set('page', 'bible');
     params.set('book', book);
     params.set('chapter', chapter.toString());
     params.set('version', version);
     if (verses.length > 0) {
         params.set('verses', verses.map(v => v.num).sort((a, b) => a - b).join(','));
     }
     // Use official domain for shared links to ensure consistency
     return `https://trueharvest.world/?${params.toString()}`;
  };

  const reference = formatReference();
  const verseText = verses.map(v => `[${v.num}] ${v.text}`).join('\n');
  const shareLink = generateDeepLink();
  
  // Share text includes the verse, reference, and explicit source domain
  const shareText = `${verseText}\n\n${reference}\nSource: ${shareLink}`;
  
  const encodedShareText = encodeURIComponent(shareText);
  const encodedShareLink = encodeURIComponent(shareLink);

  const handleSocialShare = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleCopyText = (alertUser = true) => {
    navigator.clipboard.writeText(shareText).then(() => {
      if (alertUser) alert('Verse text copied to clipboard!');
      onClose();
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy verse.');
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
        alert('Link copied to clipboard!');
        onClose();
    }).catch(err => {
        console.error('Failed to copy link:', err);
        alert('Failed to copy link.');
    });
  };

  const handleCopyForApp = (appName: string) => {
      handleCopyText(false);
      alert(`Text copied! You can now paste it into ${appName}.`);
      onClose();
  }

  const shareOptions = [
    {
      name: 'Facebook',
      icon: <FacebookIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleSocialShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedShareLink}&quote=${encodeURIComponent(`${verseText}\n— ${reference}`)}`),
      className: 'text-blue-500 hover:bg-slate-800'
    },
    {
      name: 'X (Twitter)',
      icon: <TwitterIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleSocialShare(`https://twitter.com/intent/tweet?text=${encodedShareText}`),
      className: 'text-white hover:bg-slate-800'
    },
    {
      name: 'WhatsApp',
      icon: <WhatsappIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleSocialShare(`https://api.whatsapp.com/send?text=${encodedShareText}`),
      className: 'text-green-500 hover:bg-slate-800'
    },
     {
      name: 'Threads',
      icon: <ThreadsIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleSocialShare(`https://www.threads.net/share?text=${encodedShareText}`),
      className: 'text-slate-300 hover:bg-slate-800'
    },
    {
      name: 'Instagram',
      icon: <InstagramIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleCopyForApp('Instagram'),
      className: 'text-pink-500 hover:bg-slate-800'
    },
    {
      name: 'Snapchat',
      icon: <SnapchatIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleCopyForApp('Snapchat'),
      className: 'text-yellow-400 hover:bg-slate-800'
    },
     {
      name: 'Email',
      icon: <GmailIcon className="h-5 w-5 md:h-6 md:w-6" />,
      action: () => handleSocialShare(`mailto:?subject=Verse from True Harvest: ${reference}&body=${encodedShareText}`),
      className: 'text-red-500 hover:bg-slate-800'
    }
  ];

  return createPortal(
    <div 
        className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
    >
        <div 
            className="w-full max-w-[280px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fadeInUp flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Share Scripture</span>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-2 overflow-y-auto custom-scrollbar">
                <div className="space-y-0.5">
                  {shareOptions.map(option => (
                    <button
                      key={option.name}
                      onClick={option.action}
                      className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all duration-200 ${option.className}`}
                    >
                      {option.icon}
                      <span className="font-bold text-sm text-slate-200">{option.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-slate-800 my-2"></div>
                  
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all duration-200 text-amber-400 hover:bg-slate-800"
                  >
                    <LinkIcon className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="font-bold text-sm">Copy Link</span>
                  </button>
                  
                  <button
                    onClick={() => handleCopyText(true)}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-800"
                  >
                    <CopyIcon className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="font-bold text-sm text-slate-200">Copy Text</span>
                  </button>
                </div>
            </div>
        </div>
    </div>,
    document.body
  );
};

export default BibleSharePopover;
