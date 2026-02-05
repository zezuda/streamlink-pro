
import React, { useEffect, useState, useRef } from 'react';
import { ChatMessage } from '../types';
import { Youtube, Twitch as TwitchIcon, Clock } from 'lucide-react';

// Firebase imports for real-time cloud sync
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBg81E3YQ2Do2gASMg8WRMBiuUHO7GtSAo",
  authDomain: "streamlink-pro.firebaseapp.com",
  databaseURL: "https://streamlink-pro-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "streamlink-pro",
  storageBucket: "streamlink-pro.firebasestorage.app",
  messagingSenderId: "24197361551",
  appId: "1:24197361551:web:cb11475b053efe4f3b65fa",
  measurementId: "G-VBG329NSYF"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

interface OverlayProps {
  featuredMessage: ChatMessage | null;
}

const NumericCountdown: React.FC<{ duration: number; featuredAt: number | null }> = ({ duration, featuredAt }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!featuredAt || duration <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - featuredAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [duration, featuredAt]);

  if (duration <= 0 || !featuredAt) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-black/40 border border-white/10 rounded-full ml-auto backdrop-blur-md">
      <Clock size={16} className="text-white/60" />
      <span className="text-xl font-black text-white/90 font-mono tracking-widest">
        {timeLeft}s
      </span>
    </div>
  );
};

const Overlay: React.FC<OverlayProps> = ({ featuredMessage: initialMessage }) => {
  const [activeMsg, setActiveMsg] = useState<ChatMessage | null>(initialMessage);
  const [isVisible, setIsVisible] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [timing, setTiming] = useState<{ duration: number; featuredAt: number | null }>({
    duration: 0,
    featuredAt: null
  });
  
  const fadeTimeoutRef = useRef<number | null>(null);

  const performInwardTransition = (msg: ChatMessage, duration: number, featuredAt: number | null) => {
    setActiveMsg(msg);
    setTiming({ duration, featuredAt });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  };

  const handleIncomingMessage = (newMsg: ChatMessage | null, duration: number, featuredAt: number | null) => {
    if (newMsg?.id === activeMsg?.id && isVisible) return;

    if (newMsg) {
      if (isVisible) {
        setIsVisible(false);
        if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = window.setTimeout(() => {
          performInwardTransition(newMsg, duration, featuredAt);
        }, 800);
      } else {
        performInwardTransition(newMsg, duration, featuredAt);
      }
    } 
    else {
      setIsVisible(false);
      if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setActiveMsg(null);
      }, 800);
    }
  };

  useEffect(() => {
    const cloudRef = ref(db, 'currentComment');
    const unsubscribe = onValue(cloudRef, (snapshot) => {
      const data = snapshot.val();
      setIsCloudSynced(true);

      const incoming = (data && data.type === 'SET_FEATURED' && data.payload) 
        ? { ...data.payload, timestamp: new Date(data.payload.timestamp) } 
        : null;

      const duration = data?.autoDismissEnabled ? data.autoDismissSeconds : 0;
      const featuredAt = data?.featuredAt || null;

      handleIncomingMessage(incoming, duration, featuredAt);
    });

    return () => {
      unsubscribe();
      if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
    };
  }, [activeMsg?.id, isVisible]);

  if (!activeMsg && !isVisible) return null;

  const isTwitch = activeMsg?.platform === 'twitch';
  const platformColor = isTwitch ? '#9146FF' : '#FF0000';

  return (
    <div className="w-full h-full flex items-end justify-start p-16 pointer-events-none overflow-hidden">
      <div 
        className={`w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-left ${
          isVisible && activeMsg 
            ? 'translate-x-0 opacity-100 scale-100 blur-0' 
            : '-translate-x-20 opacity-0 scale-95 blur-md'
        }`}
      >
        <div className="relative group flex items-stretch bg-slate-950/90 border border-white/10 rounded-[2rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] overflow-hidden w-full">
          
          <div 
            className="w-3 shrink-0 transition-colors duration-500"
            style={{ backgroundColor: platformColor }}
          />

          <div className="flex flex-col p-8 space-y-4 flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <div 
                className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-white/5 shadow-inner"
              >
                {isTwitch ? (
                  <TwitchIcon size={20} className="text-[#bf94ff] fill-current" />
                ) : (
                  <Youtube size={20} className="text-[#ff4d4d] fill-current" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span 
                  className="text-2xl font-bold tracking-tight uppercase obs-text-shadow leading-none truncate"
                  style={{ color: activeMsg?.authorColor || 'white' }}
                >
                  {activeMsg?.author}
                </span>
              </div>

            </div>

            <div className="relative pl-1">
              <p className="text-4xl font-semibold leading-snug text-white obs-text-shadow tracking-tight break-words">
                {activeMsg?.text}
              </p>
            </div>
            
            {!isCloudSynced && (
              <div className="absolute top-4 right-8 text-[10px] text-white/20 font-mono italic animate-pulse uppercase tracking-[0.2em]">
                Reconnecting...
              </div>
            )}
          </div>

          <div className="shrink-0 p-8 flex items-center bg-white/[0.03] border-l border-white/5">
            <img 
              src={activeMsg?.avatarUrl} 
              alt={activeMsg?.author} 
              className="w-32 h-32 rounded-[2rem] border-2 border-white/10 shadow-2xl object-cover ring-8 ring-black/40" 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overlay;
