import { useRef, useEffect, useState } from 'react';
import { AppSettings, ChatMessage, StreamStats, HypeTrainData } from '@/types';
import { TwitchChatClient } from '@/services/twitchService';
import { YouTubeChatClient } from '@/services/youtubeService';
import { ref, set, onValue } from 'firebase/database';
import { db } from '@/src/firebase';

interface UseChatConnectionProps {
    settings: AppSettings;
    addMessage: (msg: ChatMessage) => void;
    updateStats: (platform: 'twitch' | 'youtube', stats: Partial<StreamStats>) => void;
    incrementQuota: (units: number) => void;
    readOnly?: boolean;
}

export const useChatConnection = ({ settings, addMessage, updateStats, incrementQuota, readOnly = false }: UseChatConnectionProps) => {
    const twitchClient = useRef<TwitchChatClient | null>(null);
    const youtubeClient = useRef<YouTubeChatClient | null>(null);
    const [hypeTrain, setHypeTrain] = useState<HypeTrainData | null>(null);
    const hypeTrainRef = useRef<HypeTrainData | null>(null);

    // Keep ref in sync for callbacks
    useEffect(() => {
        hypeTrainRef.current = hypeTrain;
    }, [hypeTrain]);

    useEffect(() => {
        // Cleanup previous connections
        if (twitchClient.current) twitchClient.current.disconnect();
        if (youtubeClient.current) youtubeClient.current.disconnect();

        // Reset stats
        updateStats('twitch', settings.twitchChannel ? { status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' });
        updateStats('youtube', (settings.youtubeApiKey && settings.youtubeVideoId) ? { status: 'connecting' } : { viewers: 0, status: 'offline', title: 'Not connected' });

        // Twitch Connection
        if (settings.twitchChannel) {
            twitchClient.current = new TwitchChatClient(
                settings.twitchChannel,
                (msg) => {
                    // Check settings for subscriptions
                    if (msg.eventType === 'subscription' && !settings.showSubscriptions) {
                        return;
                    }
                    addMessage(msg);
                },
                (stats) => updateStats('twitch', stats),
                (hypeTrainData) => {
                    // Check if Hype Train is enabled
                    if (!settings.showHypeTrain) {
                        // If invalidating or turning off, ensure we don't save anything or clear it?
                        // If we just return, local state won't update, effectively ignoring it.
                        // But we might want to ensure it's cleared if previously active.
                        // For now, just ignore updates.
                        return;
                    }

                    // Check if we are currently running a simulation
                    if (hypeTrainRef.current?.isTest && hypeTrainRef.current?.isActive) {
                        // If simulation is active, only allow OVERWRITE if the new data is ALSO active (real train started)
                        // If new data is null (no train), ignore it to prevent clearing the simulation
                        if (!hypeTrainData) return;
                    }

                    // Write to Firebase instead of local state directly
                    // Only write if NOT in read-only mode (prevent Overlay from overwriting)
                    if (!readOnly) {
                        set(ref(db, 'hypeTrain'), hypeTrainData);
                    }
                },
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

    const simulateHypeTrain = (data: HypeTrainData | null) => {
        // Write to Firebase
        if (data) {
            set(ref(db, 'hypeTrain'), { ...data, isTest: true });
        } else {
            set(ref(db, 'hypeTrain'), null);
        }
    };

    // Listen for Hype Train updates from Firebase
    useEffect(() => {
        const hypeTrainRef = ref(db, 'hypeTrain');
        const unsubscribe = onValue(hypeTrainRef, (snapshot) => {
            const data = snapshot.val();
            setHypeTrain(data);
        });

        return () => unsubscribe();
    }, []);

    return {
        twitchClient,
        youtubeClient,
        hypeTrain,
        simulateHypeTrain
    };
};
