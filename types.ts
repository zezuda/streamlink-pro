
export type Platform = 'twitch' | 'youtube';

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  platform: Platform;
  timestamp: Date;
  isRead: boolean;
  isFeatured: boolean;
  featuredAt?: number; // Absolute timestamp when the message was featured
  isTrashed?: boolean;
  isInteresting?: boolean;
  isFirstMessage?: boolean;
  avatarUrl?: string;
  authorColor?: string;
}

export interface StreamStats {
  viewers: number;
  status: 'online' | 'offline' | 'connecting' | 'error';
  title: string;
  errorMessage?: string;
}

export interface AppSettings {
  twitchChannel: string;
  youtubeVideoId: string;
  youtubeApiKey: string;
  showAvatars: boolean;
  fontSize: number;
  autoDismissEnabled: boolean;
  autoDismissSeconds: number;
}

export interface AppState {
  messages: ChatMessage[];
  featuredMessage: ChatMessage | null;
  stats: Record<Platform, StreamStats>;
  settings: AppSettings;
  quotaUsage: number;
}
