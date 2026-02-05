
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { X, Save, Key, Twitch, Youtube, Info, ShieldCheck, Beaker, Clock, Radio, Settings } from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  currentQuota: number;
  onTriggerTest: () => void;
  onSave: (settings: AppSettings, manualQuota?: number) => void;
  onClose: () => void;
}

type Tab = 'stream' | 'interaction' | 'dev';

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, currentQuota, onTriggerTest, onSave, onClose }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [manualQuota, setManualQuota] = useState<number>(currentQuota);
  const [activeTab, setActiveTab] = useState<Tab>('stream');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'stream', label: 'Stream', icon: <Radio size={16} /> },
    { id: 'interaction', label: 'Interactions', icon: <Clock size={16} /> },
    { id: 'dev', label: 'Developer', icon: <Beaker size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-indigo-600 rounded-lg">
              {/* Added missing 'Settings' icon from lucide-react */}
              <Settings size={20} className="text-white" />
            </div>
            DASHBOARD SETTINGS
          </h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all">
            <X size={24} />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex px-6 bg-slate-950/30 border-b border-slate-800/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5' 
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 p-8 space-y-6 custom-scrollbar overflow-y-auto bg-slate-900">
          {activeTab === 'stream' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Twitch Config */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase tracking-widest">
                  <Twitch size={16} /> Twitch Feed
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Channel Identifier</label>
                  <input 
                    type="text"
                    placeholder="e.g. shroud"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                    value={formData.twitchChannel}
                    onChange={e => setFormData({ ...formData, twitchChannel: e.target.value })}
                  />
                </div>
              </div>

              <div className="h-px bg-slate-800/50" />

              {/* YouTube Config */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest">
                  <Youtube size={16} /> YouTube Feed
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1 flex items-center gap-1.5">
                      Stream Video ID or Link
                      <span title="Paste the full URL of your live stream or just the 11-character ID.">
                        <Info size={12} className="text-slate-600" />
                      </span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. dQw4w9WgXcQ"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                      value={formData.youtubeVideoId}
                      onChange={e => setFormData({ ...formData, youtubeVideoId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1 flex justify-between">
                      Google Data API Key
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-indigo-400 hover:text-indigo-300 transition-colors">Generate Key</a>
                    </label>
                    <div className="relative">
                      <input 
                        type="password"
                        placeholder="AIza..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pl-12 text-white focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                        value={formData.youtubeApiKey}
                        onChange={e => setFormData({ ...formData, youtubeApiKey: e.target.value })}
                      />
                      <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interaction' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest">
                  <Clock size={16} /> Auto-Dismiss Features
                </div>
                
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-slate-200 font-black tracking-tight">Enable Timer</span>
                      <p className="text-[11px] text-slate-500 leading-relaxed max-w-[280px]">Automatically dismisses featured comments after the specified duration.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.autoDismissEnabled}
                        onChange={e => setFormData({ ...formData, autoDismissEnabled: e.target.checked })}
                      />
                      <div className="w-12 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-lg"></div>
                    </label>
                  </div>

                  {formData.autoDismissEnabled && (
                    <div className="space-y-4 pt-4 border-t border-slate-800/50 animate-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Visibility Duration</label>
                        <span className="text-lg font-mono font-black text-indigo-400">
                          {formData.autoDismissSeconds}<span className="text-xs ml-0.5 text-slate-600">s</span>
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="3" 
                        max="60" 
                        step="1"
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        value={formData.autoDismissSeconds}
                        onChange={e => setFormData({ ...formData, autoDismissSeconds: parseInt(e.target.value, 10) })}
                      />
                      <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1">
                        <span>3s</span>
                        <span>30s</span>
                        <span>60s</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dev' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-500 font-black text-xs uppercase tracking-widest">
                  <ShieldCheck size={16} /> Debug & Maintenance
                </div>
                
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between gap-6">
                     <div className="flex flex-col gap-1">
                       <span className="text-sm text-slate-200 font-black tracking-tight">Chat Simulation</span>
                       <p className="text-[11px] text-slate-500 leading-relaxed">Push test messages into the live feed.</p>
                     </div>
                     <button 
                       onClick={onTriggerTest}
                       className="shrink-0 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-700 transition-all active:scale-95 shadow-md"
                     >
                       GENERATE FEED
                     </button>
                  </div>

                  <div className="h-px bg-slate-800/50" />

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-slate-200 font-black tracking-tight">Manual Quota Sync</span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">Override the estimated API consumption count.</p>
                    </div>
                    <div className="relative">
                      <input 
                        type="number"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-slate-600 transition-colors font-mono text-sm"
                        value={manualQuota}
                        onChange={e => setManualQuota(parseInt(e.target.value, 10) || 0)}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-black uppercase">Units</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="p-8 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            StreamLink Pro v1.2.4
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={() => onSave(formData, manualQuota)}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Save size={18} /> Apply Changes
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
