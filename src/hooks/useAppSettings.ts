import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
    twitchChannel: '',
    twitchClientId: import.meta.env.VITE_TWITCH_CLIENT_ID || '',
    twitchAccessToken: import.meta.env.VITE_TWITCH_ACCESS_TOKEN || '',
    youtubeVideoId: '',
    youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY || '',
    showAvatars: true,
    fontSize: 14,
    autoDismissEnabled: true,
    autoDismissSeconds: 15,
};

const getPTDateString = () => {
    return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
};

export const useAppSettings = () => {
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

    useEffect(() => {
        const { youtubeVideoId, ...persistentSettings } = settings;
        localStorage.setItem('streamlink_settings', JSON.stringify(persistentSettings));
    }, [settings]);

    useEffect(() => {
        localStorage.setItem('youtube_quota_usage', quotaUsage.toString());
    }, [quotaUsage]);

    const incrementQuota = useCallback((units: number) => {
        setQuotaUsage(prev => prev + units);
    }, []);

    return {
        settings,
        setSettings,
        quotaUsage,
        setQuotaUsage,
        incrementQuota
    };
};
