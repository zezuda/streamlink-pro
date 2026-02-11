
import React, { useState, useEffect } from 'react';
import { AppState, ChatMessage, StreamStats } from '../types';
import MessageItem from './MessageItem';
import { PinnedMessagesWidget } from './PinnedMessagesWidget';
import {
  Settings,
  Copy,
  Layers,
  MessageSquare,
  Zap,
  AlertCircle,
  Loader2,
  Check,
  BarChart3,
  ExternalLink,
  ShieldCheck,
  Edit2,
  MousePointer2,
  Bookmark,
  Trash2,
  Keyboard,
  Clock,
  Coins
} from 'lucide-react';

interface DashboardProps {
  state: AppState;
  onFeature: (id: string) => void;
  onMarkRead: (id: string) => void;
  onMarkTrash: (id: string) => void;
  onToggleInteresting: (id: string) => void;
  onClearFeatured: () => void;
  onOpenSettings: () => void;
}

const QUOTA_LIMIT = 10000;

const NumericCountdown: React.FC<{ duration: number; enabled: boolean; featuredAt?: number }> = ({ duration, enabled, featuredAt }) => {
  const [percentage, setPercentage] = useState(100);

  useEffect(() => {
    if (!enabled || duration <= 0 || !featuredAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - featuredAt;
      const total = duration * 1000;
      const remaining = Math.max(0, 100 - (elapsed / total) * 100);
      setPercentage(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [duration, enabled, featuredAt]);

  if (!enabled || !featuredAt) return null;

  return (
    <div className="relative overflow-hidden flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full w-full">
      <div
        className="absolute inset-y-0 left-0 bg-indigo-500/40 transition-all duration-75 ease-linear"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const StatusIndicator: React.FC<{
  platform: string;
  stats: StreamStats;
  icon: React.ReactNode;
}> = ({ platform, stats, icon }) => {
  const isOnline = stats.status === 'online';
  const isConnecting = stats.status === 'connecting';
  const isError = stats.status === 'error';
  const isQuotaError = stats.errorMessage?.includes('Quota');

  return (
    <div className={`p-3 rounded-xl bg-slate-900 border transition-colors flex flex-col min-h-[84px] ${isError ? 'border-red-500/50' : isOnline ? 'border-emerald-500/20' : 'border-slate-800'}`}>
      <div className="text-slate-500 text-[10px] mb-1 flex items-center justify-between gap-1 uppercase font-bold tracking-wider">
        <span className="flex items-center gap-1">{icon} {platform}</span>
        {isConnecting && <Loader2 size={10} className="animate-spin text-indigo-400" />}
        {isError && <AlertCircle size={10} className="text-red-500" />}
      </div>
      {isError ? (
        <div className="mt-auto flex flex-col">
          <span className="text-red-400 text-[9px] leading-tight font-black uppercase" title={stats.errorMessage}>
            {isQuotaError ? 'Quota Exceeded' : (stats.errorMessage || 'Failed')}
          </span>
          {isQuotaError && (
            <a
              href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
              target="_blank"
              className="text-[8px] text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
            >
              Check Limits <ExternalLink size={8} />
            </a>
          )}
        </div>
      ) : (
        <div className="mt-auto flex flex-col">
          <span className="text-white font-mono font-bold text-xl">{stats.viewers.toLocaleString()}</span>
          <span className={`${isOnline ? 'text-emerald-500' : isConnecting ? 'text-indigo-400' : 'text-slate-600'} text-[9px] font-bold uppercase tracking-widest`}>
            {isConnecting ? 'connecting' : isOnline ? 'online' : 'offline'}
          </span>
        </div>
      )}
    </div>
  );
};

const QuotaTracker: React.FC<{ used: number, onEdit: () => void }> = ({ used, onEdit }) => {
  const percentage = Math.min((used / QUOTA_LIMIT) * 100, 100);
  const isHigh = percentage > 80;
  const isExceeded = percentage >= 100;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 space-y-2 group transition-all">
      <div className="flex justify-between items-center">
        <h3 className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5">
          <ShieldCheck size={10} className={isExceeded ? 'text-red-500' : isHigh ? 'text-amber-500' : 'text-emerald-500'} />
          API Quota (Estimated)
        </h3>
        <button
          onClick={onEdit}
          className="p-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-all bg-slate-800 rounded"
          title="Manual Sync"
        >
          <Edit2 size={8} />
        </button>
      </div>
      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${isExceeded ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-[9px] font-bold">
        <span className={`${isExceeded ? 'text-red-500' : 'text-slate-500'}`}>
          {used.toLocaleString()} / {QUOTA_LIMIT.toLocaleString()}
        </span>
        <a
          href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
          target="_blank"
          className="text-indigo-400 hover:underline flex items-center gap-1"
        >
          Console <ExternalLink size={8} />
        </a>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({
  state,
  onFeature,
  onMarkRead,
  onMarkTrash,
  onToggleInteresting,
  onClearFeatured,
  onOpenSettings
}) => {
  const [copied, setCopied] = useState(false);

  const copyOverlayUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}#/overlay`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScrollToMessage = (id: string) => {
    const element = document.getElementById(`message-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Use standard CSS class for highlighting if Tailwind safelist permits, or inline style
      element.classList.add('ring-2', 'ring-emerald-500');
      setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500'), 1000);
    }
  };

  const unreadCount = state.messages.filter(m => !m.isRead).length;

  return (
    <div className="flex flex-1 bg-slate-950 h-full overflow-hidden">
      <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        <section className="flex-1 flex flex-col min-w-0 border-r border-slate-800 bg-slate-900/50">
          <header className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20 gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group relative cursor-help">
                <MessageSquare className="text-white w-6 h-6" />
                <div className="absolute top-full left-0 mt-2 w-max px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl uppercase tracking-wider">
                  Live Feed Status
                </div>
              </div>
              <div>
                <h1 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
                  STREAM FEED <span className={`flex h-2 w-2 rounded-full ${state.messages.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} title={state.messages.length > 0 ? "Feed Active" : "No recent activity"}></span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800 mr-2">
                {/* Sync indicator only active when at least one service is online */}
                <div className={`w-2 h-2 rounded-full ${state.stats.twitch.status === 'online' || state.stats.youtube.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Syncing</span>
              </div>

              <button
                onClick={copyOverlayUrl}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${copied ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Overlay Link'}
              </button>
              <div className="w-px h-6 bg-slate-800 mx-1" />
              <button
                onClick={onOpenSettings}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-all"
                title="Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 pb-24">
            {state.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <div className="p-6 rounded-full bg-slate-800/50 animate-pulse">
                  <Zap size={48} className="opacity-20" />
                </div>
                <div className="text-center max-w-xs">
                  <p className="text-lg font-bold text-slate-400">Feed is silent...</p>
                  <p className="text-xs mt-2 leading-relaxed">Connect your accounts in settings to start capturing live comments.</p>
                  <button
                    onClick={onOpenSettings}
                    className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-indigo-600/20"
                  >
                    Configuration
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Interaction Tips Banner */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2.5 mb-2 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <MousePointer2 size={12} className="text-indigo-500" />
                    Click: Feature
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Bookmark size={12} className="text-amber-500" />
                    Right-Click: Interesting
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Trash2 size={12} className="text-red-500" />
                    Trash Icon: Trash/Done
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Keyboard size={12} className="text-slate-200" />
                    ESC: Clear Featured
                  </div>
                </div>

                {state.messages.map(msg => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onFeature={onFeature}
                    onMarkRead={onMarkRead}
                    onMarkTrash={onMarkTrash}
                    onToggleInteresting={onToggleInteresting}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        <section className="w-full md:w-80 lg:w-96 bg-slate-950 flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <BarChart3 size={12} /> Live Audience
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatusIndicator
                platform="Twitch"
                stats={state.stats.twitch}
                icon={<svg className="w-3 h-3 text-purple-400 fill-current" viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57V4.714zm4.715 0H18v5.143h-1.714V4.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" /></svg>}
              />
              <StatusIndicator
                platform="YouTube"
                stats={state.stats.youtube}
                icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000" /><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" /></svg>}
              />
            </div>
          </div>

          {/* Pinned Donations Widget */}
          <PinnedMessagesWidget
            messages={state.messages}
            onMessageClick={handleScrollToMessage}
          />

          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <Layers size={12} /> OBS Overlay Preview
              </h2>
              {state.featuredMessage && (
                <button
                  onClick={onClearFeatured}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold px-2 py-1 bg-red-400/10 rounded border border-red-500/20"
                >
                  Dismiss
                </button>
              )}
            </div>

            <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all flex flex-col justify-center items-center min-h-[220px] text-center ${state.featuredMessage ? 'bg-indigo-600/10 border-indigo-500 shadow-2xl shadow-indigo-500/10' : 'bg-slate-900/50 border-dashed border-slate-800'}`}>
              {state.featuredMessage ? (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300 z-10 w-full px-4 flex flex-col items-center">
                  <div className="relative inline-block">
                    <img
                      src={state.featuredMessage.avatarUrl}
                      className="w-16 h-16 rounded-2xl border-2 border-indigo-500/50 mx-auto object-cover"
                      alt="Author"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-slate-950 flex items-center justify-center ${state.featuredMessage.platform === 'twitch' ? 'bg-purple-600' : 'bg-red-600'}`}>
                      {state.featuredMessage.platform === 'twitch' ? (
                        <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57V4.714zm4.715 0H18v5.143h-1.714V4.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" /></svg>
                      ) : (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="white" /><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000" /></svg>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white text-lg font-black leading-tight break-words">"{state.featuredMessage.text}"</p>
                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">@{state.featuredMessage.author}</p>
                    {state.featuredMessage.donationAmount && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 mt-1">
                        <Coins size={10} strokeWidth={3} /> {state.featuredMessage.donationAmount}
                      </span>
                    )}
                  </div>

                  {/* Numeric Countdown Display */}
                  {state.settings.autoDismissEnabled && (
                    <div className="mt-4 w-full">
                      <NumericCountdown
                        duration={state.settings.autoDismissSeconds}
                        enabled={state.settings.autoDismissEnabled}
                        featuredAt={state.featuredMessage.featuredAt}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-600 space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-800 flex items-center justify-center mx-auto mb-2">
                    <Layers size={20} className="opacity-40" />
                  </div>
                  <p className="text-xs font-medium px-4">Click any message in the feed to push it to your stream overlay.</p>
                  <p className="text-[10px] text-slate-500">Make sure the Overlay tab is open for sync to work.</p>
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]"></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
