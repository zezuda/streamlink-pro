
import React, { useEffect, useState, useRef } from 'react';
import { ChatMessage } from '../types';
import { Youtube, Twitch as TwitchIcon, Clock, DollarSign } from 'lucide-react';

// Firebase imports from npm
import { ref, onValue } from 'firebase/database';
import { db } from '@/src/firebase';

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
  let platformColor = isTwitch ? '#9146FF' : '#FF0000';

  // Donation Logic for Styling
  const donationAmount = activeMsg?.donationAmount;
  const isDonation = !!donationAmount;

  if (isDonation) {
    const amountVal = parseFloat(donationAmount?.replace(/[^0-9.]/g, '') || '0');
    if (amountVal >= 2000) platformColor = '#dc26267a'; // Red
    else if (amountVal >= 1000) platformColor = '#9333ea7a'; // Purple
    else if (amountVal >= 500) platformColor = '#d977067a'; // Amber
    else if (amountVal >= 200) platformColor = '#0891b27a'; // Cyan
    else platformColor = '#0596697a'; // Emerald
  }

  return (
    <div className="w-full h-full flex items-end justify-start p-16 pointer-events-none overflow-hidden">
      <div
        className={`w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-left ${isVisible && activeMsg
          ? 'translate-x-0 opacity-100 scale-100 blur-0'
          : '-translate-x-20 opacity-0 scale-95 blur-md'
          }`}
      >
        <div
          className={`relative group flex items-stretch border border-white/10 rounded-[2rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] overflow-hidden w-full ${!isDonation ? 'bg-slate-950/90' : ''}`}
          style={isDonation ? { backgroundColor: platformColor } : undefined}
        >

          <div
            className="w-3 shrink-0 transition-colors duration-500"
            style={{ backgroundColor: platformColor }}
          />

          <div className="flex flex-col p-8 space-y-4 flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center p-2 rounded-xl border border-white/10 shadow-inner"
                style={!isDonation ? { backgroundColor: platformColor } : { backgroundColor: '#FF0000' }}
              >
                {isTwitch ? (
                  <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57V4.714zm4.715 0H18v5.143h-1.714V4.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="white" /><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000" /></svg>
                )}
              </div>

              <span
                className="text-2xl font-bold tracking-tight uppercase obs-text-shadow leading-none truncate text-white overflow-visible"
              >
                {activeMsg?.author}
              </span>

              {isDonation && (
                <span className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/20 border border-white/10 text-white font-black text-xl tracking-widest shadow-lg">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse bg-white"
                  />
                  {donationAmount}
                </span>
              )}
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

    </div >
  );
};

export default Overlay;
