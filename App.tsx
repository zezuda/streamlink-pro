
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppState, ChatMessage, Platform, AppSettings } from './types';
import Dashboard from './components/Dashboard';
import Overlay from './components/Overlay';
import SettingsModal from './components/SettingsModal';
import { TwitchChatClient } from './services/twitchService';
import { YouTubeChatClient } from './services/youtubeService';
import { Youtube, Play, X, Info } from 'lucide-react';

// Firebase imports for cloud sync
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const DEFAULT_SETTINGS: AppSettings = {
  twitchChannel: '',
  youtubeVideoId: '',
  youtubeApiKey: '',
  showAvatars: true,
  fontSize: 14,
  autoDismissEnabled: false,
  autoDismissSeconds: 15,
};

const syncChannel = new BroadcastChannel('streamlink_sync');

const getPTDateString = () => {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
};

const App: React.FC = () => {
  const location = useLocation();
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('streamlink_settings');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      return { 
        ...DEFAULT_SETTINGS,
        ...parsed, 
        youtubeVideoId: '' 
      };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  const [quotaUsage, setQuotaUsage] = useState<number>(() => {
    try {
      const savedUsage = localStorage.getItem('youtube_quota_usage');
      const lastReset = localStorage.getItem('youtube_quota_last_reset');
      const todayPT = getPTDateString();
      
      if (lastReset !== todayPT) {
        localStorage.setItem('youtube_quota_last_reset', todayPT);
        localStorage.setItem('youtube_quota_usage', '0');
        return 0;
      }
      return savedUsage ? parseInt(savedUsage, 10) : 0;
    } catch (e) {
      return 0;
    }
  });

  const [state, setState] = useState<AppState>({
    messages: [],
    featuredMessage: null,
    stats: {
      twitch: { viewers: 0, status: 'offline', title: 'Not connected' },
      youtube: { viewers: 0, status: 'offline', title: 'Not connected' },
    },
    settings,
    quotaUsage
  });

  useEffect(() => {
    setState(prev => ({ ...prev, quotaUsage }));
    localStorage.setItem('youtube_quota_usage', quotaUsage.toString());
  }, [quotaUsage]);

  const incrementQuota = useCallback((units: number) => {
    setQuotaUsage(prev => prev + units);
  }, []);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLaunchPrompt, setShowLaunchPrompt] = useState(false);
  
  const twitchClient = useRef<TwitchChatClient | null>(null);
  const youtubeClient = useRef<YouTubeChatClient | null>(null);
  const autoDismissTimerRef = useRef<number | null>(null);

  const broadcastFeatured = useCallback((msg: ChatMessage | null) => {
    const featuredAt = msg ? Date.now() : null;
    const payload = { 
      type: msg ? 'SET_FEATURED' : 'CLEAR_FEATURED', 
      payload: msg ? { ...msg, featuredAt } : null,
      timestamp: Date.now(),
      autoDismissEnabled: settings.autoDismissEnabled,
      autoDismissSeconds: settings.autoDismissSeconds,
      featuredAt: featuredAt
    };

    set(ref(db, 'currentComment'), {
      ...payload,
      payload: msg ? {
        ...msg,
        featuredAt,
        timestamp: msg.timestamp.toISOString()
      } : null
    });

    syncChannel.postMessage(payload);
    localStorage.setItem('streamlink_sync_event', JSON.stringify(payload));
  }, [settings.autoDismissEnabled, settings.autoDismissSeconds]);

  const markAsRead = useCallback((id: string) => {
    setState(prev => {
        const isCurrentlyFeatured = prev.featuredMessage?.id === id;
        if (isCurrentlyFeatured) {
          broadcastFeatured(null);
        }
        return {
            ...prev,
            featuredMessage: isCurrentlyFeatured ? null : prev.featuredMessage,
            messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true, isFeatured: false, isTrashed: false, featuredAt: undefined } : m)
        };
    });
  }, [broadcastFeatured]);

  const clearFeatured = useCallback(() => {
    broadcastFeatured(null);
    setState(prev => ({
        ...prev,
        featuredMessage: null,
        messages: prev.messages.map(m => ({ ...m, isFeatured: false, featuredAt: undefined }))
    }));
  }, [broadcastFeatured]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.featuredMessage) {
          markAsRead(state.featuredMessage.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.featuredMessage, markAsRead]);

  useEffect(() => {
    if (autoDismissTimerRef.current) {
      window.clearTimeout(autoDismissTimerRef.current);
    }

    if (state.featuredMessage && settings.autoDismissEnabled) {
      autoDismissTimerRef.current = window.setTimeout(() => {
        if (state.featuredMessage) {
          markAsRead(state.featuredMessage.id);
        }
      }, settings.autoDismissSeconds * 1000);
    }

    return () => {
      if (autoDismissTimerRef.current) window.clearTimeout(autoDismissTimerRef.current);
    };
  }, [state.featuredMessage, settings.autoDismissEnabled, settings.autoDismissSeconds, markAsRead]);

  useEffect(() => {
    if (location.pathname === '/') {
      broadcastFeatured(null);
    }
  }, [location.pathname, broadcastFeatured]);

  useEffect(() => {
    if (settings.youtubeApiKey && !settings.youtubeVideoId && location.pathname === '/') {
      setShowLaunchPrompt(true);
    }
  }, [settings.youtubeApiKey, settings.youtubeVideoId, location.pathname]);

  useEffect(() => {
    const { youtubeVideoId, ...persistentSettings } = settings;
    localStorage.setItem('streamlink_settings', JSON.stringify(persistentSettings));
    setState(s => ({ ...s, settings }));
  }, [settings]);

  useEffect(() => {
    const handleSync = (event: MessageEvent) => {
      if (event.data.type === 'SET_FEATURED') {
        setState(prev => ({
          ...prev,
          featuredMessage: event.data.payload,
          messages: prev.messages.map(m => ({
            ...m,
            isFeatured: m.id === event.data.payload?.id,
            featuredAt: m.id === event.data.payload?.id ? event.data.payload?.featuredAt : m.featuredAt
          }))
        }));
      } else if (event.data.type === 'CLEAR_FEATURED') {
        setState(prev => ({
          ...prev,
          featuredMessage: null,
          messages: prev.messages.map(m => ({ ...m, isFeatured: false, featuredAt: undefined }))
        }));
      }
    };

    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, []);

  useEffect(() => {
    twitchClient.current?.disconnect();
    youtubeClient.current?.disconnect();

    setState(s => ({
      ...s,
      stats: {
        twitch: settings.twitchChannel ? { ...s.stats.twitch, status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' },
        youtube: (settings.youtubeApiKey && settings.youtubeVideoId) ? { ...s.stats.youtube, status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' },
      }
    }));

    if (settings.twitchChannel) {
      twitchClient.current = new TwitchChatClient(settings.twitchChannel, (msg) => {
        addMessage(msg);
      });
      twitchClient.current.connect();
      setState(s => ({ ...s, stats: { ...s.stats, twitch: { ...s.stats.twitch, status: 'online', viewers: 0 } } }));
    }

    if (settings.youtubeApiKey && settings.youtubeVideoId) {
      youtubeClient.current = new YouTubeChatClient(
        settings.youtubeApiKey, 
        settings.youtubeVideoId, 
        (msg) => addMessage(msg),
        (status, error) => {
          setState(s => ({ 
            ...s, 
            stats: { 
              ...s.stats, 
              youtube: { 
                ...s.stats.youtube, 
                status: status, 
                errorMessage: error 
              } 
            } 
          }));
        },
        incrementQuota
      );
      youtubeClient.current.connect();
    }

    return () => {
      twitchClient.current?.disconnect();
      youtubeClient.current?.disconnect();
    };
  }, [settings.twitchChannel, settings.youtubeApiKey, settings.youtubeVideoId, incrementQuota]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setState(prev => ({
      ...prev,
      messages: [msg, ...prev.messages].slice(0, 200)
    }));
  }, []);

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

  const featureMessage = useCallback((id: string) => {
    setState(prev => {
      const msg = prev.messages.find(m => m.id === id) || null;
      const prevFeaturedId = prev.featuredMessage?.id;
      const featuredAt = Date.now();
      
      const updatedMsg = msg ? { ...msg, isFeatured: true, featuredAt } : null;
      broadcastFeatured(updatedMsg);
      
      return {
        ...prev,
        featuredMessage: updatedMsg,
        messages: prev.messages.map(m => {
          if (m.id === id) {
            return { ...m, isFeatured: true, isRead: false, isTrashed: false, featuredAt };
          }
          if (prevFeaturedId && m.id === prevFeaturedId && m.id !== id) {
            return { ...m, isFeatured: false, isRead: true, isTrashed: false, featuredAt: undefined };
          }
          return { ...m, isFeatured: false, featuredAt: undefined };
        })
      };
    });
  }, [broadcastFeatured]);

  const markAsTrashed = useCallback((id: string) => {
    setState(prev => {
      const isCurrentlyFeatured = prev.featuredMessage?.id === id;
      if (isCurrentlyFeatured) {
        broadcastFeatured(null);
      }
      return {
        ...prev,
        featuredMessage: isCurrentlyFeatured ? null : prev.featuredMessage,
        messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true, isTrashed: true, isFeatured: false, featuredAt: undefined } : m)
      };
    });
  }, [broadcastFeatured]);

  const toggleInteresting = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => 
        m.id === id ? { ...m, isInteresting: !m.isInteresting } : m
      )
    }));
  }, []);

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden ${location.pathname.includes('overlay') ? 'bg-transparent' : 'bg-slate-950'}`}>
      <Routes>
        <Route 
          path="/" 
          element={
            <Dashboard 
              state={state} 
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
            <Overlay featuredMessage={state.featuredMessage} />
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
        />
      )}
    </div>
  );
};

export default App;
