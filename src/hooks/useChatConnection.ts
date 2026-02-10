import { useRef, useEffect } from 'react';
import { AppSettings, ChatMessage, StreamStats } from '@/types';
import { TwitchChatClient } from '@/services/twitchService';
import { YouTubeChatClient } from '@/services/youtubeService';

interface UseChatConnectionProps {
    settings: AppSettings;
    addMessage: (msg: ChatMessage) => void;
    updateStats: (platform: 'twitch' | 'youtube', stats: Partial<StreamStats>) => void;
    incrementQuota: (units: number) => void;
}

export const useChatConnection = ({ settings, addMessage, updateStats, incrementQuota }: UseChatConnectionProps) => {
    const twitchClient = useRef<TwitchChatClient | null>(null);
    const youtubeClient = useRef<YouTubeChatClient | null>(null);

    useEffect(() => {
        // Cleanup previous connections
        twitchClient.current?.disconnect();
        youtubeClient.current?.disconnect();

        // Reset stats
        updateStats('twitch', settings.twitchChannel ? { status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' });
        updateStats('youtube', (settings.youtubeApiKey && settings.youtubeVideoId) ? { status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' });

        // Twitch Connection
        if (settings.twitchChannel) {
            twitchClient.current = new TwitchChatClient(
                settings.twitchChannel,
                (msg) => {
                    addMessage(msg);
                },
                (stats) => updateStats('twitch', stats),
                settings.twitchAccessToken,
                settings.twitchClientId,
                (status, error) => {
                    updateStats('twitch', {
                        status: status as any,
                        errorMessage: error
                    });
                }
            );
            twitchClient.current.connect();
        }

        // YouTube Connection
        if (settings.youtubeApiKey && settings.youtubeVideoId) {
            youtubeClient.current = new YouTubeChatClient(
                settings.youtubeApiKey,
                settings.youtubeVideoId,
                (msg) => addMessage(msg),
                (status, error) => {
                    updateStats('youtube', {
                        status: status,
                        errorMessage: error
                    });
                },
                incrementQuota,
                (stats) => updateStats('youtube', stats)
            );
            youtubeClient.current.connect();
        }

        return () => {
            twitchClient.current?.disconnect();
            youtubeClient.current?.disconnect();
        };
    }, [
        settings.twitchChannel,
        settings.youtubeApiKey,
        settings.youtubeVideoId,
        addMessage,
        updateStats,
        incrementQuota,
        settings.twitchAccessToken,
        settings.twitchClientId
    ]);

    return {
        twitchClient,
        youtubeClient
    };
};
