import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ChatMessage, Platform } from './types';
import Dashboard from './components/Dashboard';
import Overlay from './components/Overlay';
import SettingsModal from './components/SettingsModal';
import { Youtube, Play, Info } from 'lucide-react';
import { useAppSettings } from '@/src/hooks/useAppSettings';
import { useMessageStore } from '@/src/hooks/useMessageStore';
import { useChatConnection } from '@/src/hooks/useChatConnection';

const App: React.FC = () => {
  const location = useLocation();
  const { settings, setSettings, quotaUsage, setQuotaUsage, incrementQuota } = useAppSettings();
  const {
    state: messageState,
    addMessage,
    markAsRead,
    clearFeatured,
    featureMessage,
    markAsTrashed,
    toggleInteresting,
    updateStats,
    broadcastFeatured
  } = useMessageStore(settings);

  const { twitchClient, youtubeClient } = useChatConnection({
    settings,
    addMessage,
    updateStats,
    incrementQuota
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLaunchPrompt, setShowLaunchPrompt] = useState(false);
  const autoDismissTimerRef = useRef<number | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (messageState.featuredMessage) {
          markAsRead(messageState.featuredMessage.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messageState.featuredMessage, markAsRead]);

  // Keep a ref to settings to access fresh values inside timeouts
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Auto-dismiss logic
  useEffect(() => {
    if (autoDismissTimerRef.current) {
      window.clearTimeout(autoDismissTimerRef.current);
    }

    if (messageState.featuredMessage) {
      // Determine duration: Use message-specific duration (e.g. donation) or global setting
      const durationSeconds = messageState.featuredMessage.pinnedDuration || settings.autoDismissSeconds;

      // Only set timer if enabled OR if it's a donation (donations usually have fixed expiry, but let's respect the master toggle)
      // User asked: "turn off auto-dismissal options... message still gets dismissed".
      // So if master toggle is off, nothing should auto-dismiss.
      if (settings.autoDismissEnabled) {
        autoDismissTimerRef.current = window.setTimeout(() => {
          // Double check: ensure master toggle is still on and message is still featured
          if (settingsRef.current.autoDismissEnabled && messageState.featuredMessage) {
            markAsRead(messageState.featuredMessage.id);
          }
        }, durationSeconds * 1000);
      }
    }

    return () => {
      if (autoDismissTimerRef.current) window.clearTimeout(autoDismissTimerRef.current);
    };
  }, [messageState.featuredMessage, settings.autoDismissEnabled, settings.autoDismissSeconds, markAsRead]);

  // Clear featured on home page load
  useEffect(() => {
    if (location.pathname === '/') {
      broadcastFeatured(null);
    }
  }, [location.pathname, broadcastFeatured]);

  // Launch prompt logic
  useEffect(() => {
    if (settings.youtubeApiKey && !settings.youtubeVideoId && location.pathname === '/') {
      setShowLaunchPrompt(true);
    }
  }, [settings.youtubeApiKey, settings.youtubeVideoId, location.pathname]);

  const triggerTestMessages = useCallback(() => {
    const dummyNames = ["CyberPunk_2077", "StreamGod", "PixelViper", "GlitchMaster", "NebulaKnight", "EchoAlpha"];
    const dummyTexts = [
      "Can you show that camera setting again? Looks sick!",
      "Hype in the chat! Let's goooo 🚀🚀🚀",
      "Which GPU are you using for this stream?",
      "Just joined, what did I miss?",
      "Is that a custom keyboard? Sounds really thocky.",
      "LUL that was a close one, almost died there!"
    ];

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const platform = Math.random() > 0.5 ? 'twitch' : 'youtube';
        const author = dummyNames[Math.floor(Math.random() * dummyNames.length)];
        const text = dummyTexts[Math.floor(Math.random() * dummyTexts.length)];

        const msg: ChatMessage = {
          id: Math.random().toString(36).substring(7),
          author,
          text,
          platform: platform as Platform,
          timestamp: new Date(),
          isRead: false,
          isFeatured: false,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${author}`,
          authorColor: platform === 'twitch' ? '#bf94ff' : '#ff4d4d',
          isFirstMessage: Math.random() > 0.8
        };
        addMessage(msg);
      }, i * 400);
    }
  }, [addMessage]);

  const simulateDonation = useCallback((amount: string, color: string, duration: number) => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      author: "SuperFan_99",
      text: "Keep up the great work! Here is some support for the stream! 💖",
      platform: 'youtube',
      timestamp: new Date(),
      isRead: false,
      isFeatured: false,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=SuperFan_99`,
      authorColor: color,
      donationAmount: amount, // e.g. "500 CZK"
      pinnedDuration: duration,
      pinnedAt: Date.now()
    };
    addMessage(msg);
  }, [addMessage]);

  // Merge state for Dashboard
  const dashboardState = {
    ...messageState,
    settings,
    quotaUsage
  };

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden ${location.pathname.includes('overlay') ? 'bg-transparent' : 'bg-slate-950'}`}>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              state={dashboardState}
              onFeature={featureMessage}
              onMarkRead={markAsRead}
              onMarkTrash={markAsTrashed}
              onToggleInteresting={toggleInteresting}
              onClearFeatured={clearFeatured}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          }
        />
        <Route
          path="/overlay"
          element={
            <Overlay featuredMessage={messageState.featuredMessage} />
          }
        />
      </Routes>

      {showLaunchPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                <Youtube size={32} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Launch Stream</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enter your YouTube stream link or ID to connect.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="YouTube Studio URL or ID..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-medium pr-12"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSettings({ ...settings, youtubeVideoId: (e.target as HTMLInputElement).value });
                      setShowLaunchPrompt(false);
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    setSettings({ ...settings, youtubeVideoId: input.value });
                    setShowLaunchPrompt(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                >
                  <Play size={20} fill="currentColor" />
                </button>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-slate-500 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                <Info size={14} className="shrink-0" />
                <p>Handles URLs like <code>studio.youtube.com/video/ID/livestreaming</code></p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setShowLaunchPrompt(false)}
                className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Skip YouTube
              </button>
              <button
                onClick={() => { setShowLaunchPrompt(false); setIsSettingsOpen(true); }}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Edit Config
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          currentQuota={quotaUsage}
          onTriggerTest={triggerTestMessages}
          onSave={(newSettings, manualQuota) => {
            setSettings(newSettings);
            if (manualQuota !== undefined) setQuotaUsage(manualQuota);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
          onSimulateDonation={simulateDonation}
        />
      )}
    </div>
  );
};

export default App;
