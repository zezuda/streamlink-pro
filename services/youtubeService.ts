
import { ChatMessage } from "../types";

export class YouTubeChatClient {
  private apiKey: string;
  private videoId: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: 'online' | 'error', error?: string) => void;
  private onQuotaUpdate: (units: number) => void;
  private liveChatId: string | null = null;
  private nextPollToken: string | null = null;
  private pollInterval: number = 2000;
  private timer: any = null;
  private isPaused: boolean = false;
  private isQuotaExceeded: boolean = false;

  constructor(
    apiKey: string, 
    videoId: string, 
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: 'online' | 'error', error?: string) => void,
    onQuotaUpdate: (units: number) => void
  ) {
    this.apiKey = apiKey;
    this.videoId = this.extractVideoId(videoId);
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onQuotaUpdate = onQuotaUpdate;
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.isPaused = true;
      if (this.timer) clearTimeout(this.timer);
    } else {
      this.isPaused = false;
      if (this.liveChatId && !this.isQuotaExceeded) {
        this.poll();
      }
    }
  };

  private extractVideoId(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    try {
      if (trimmed.includes('studio.youtube.com/video/')) {
        const match = trimmed.match(/\/video\/([^\/]+)/);
        if (match) return match[1];
      }
      if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        if (trimmed.includes('youtu.be')) return url.pathname.slice(1);
        return url.searchParams.get('v') || trimmed;
      }
    } catch (e) {}
    return trimmed;
  }

  async connect() {
    this.isQuotaExceeded = false;
    if (!this.apiKey || !this.videoId) {
      this.onStatusChange('error', 'Missing API Key or Video ID');
      return;
    }
    
    try {
      // videos.list = 1 unit
      const videoResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${this.videoId}&part=liveStreamingDetails,snippet&key=${this.apiKey}`);
      this.onQuotaUpdate(1);
      const videoData = await videoResp.json();
      
      if (videoData.error) {
        if (videoData.error.code === 403) {
          this.isQuotaExceeded = true;
          throw new Error('API Quota Exceeded');
        }
        throw new Error(videoData.error.message || 'YouTube API Error');
      }

      if (!videoData.items || videoData.items.length === 0) {
        throw new Error('Video not found. Check your Video ID.');
      }

      const item = videoData.items[0];
      this.liveChatId = item.liveStreamingDetails?.activeLiveChatId;
      
      if (!this.liveChatId) {
        throw new Error('No active live chat found.');
      }

      this.onStatusChange('online');
      this.startPolling();
    } catch (e: any) {
      this.onStatusChange('error', e.message);
    }
  }

  private startPolling() {
    this.poll();
  }

  private async poll() {
    if (!this.liveChatId || this.isPaused || this.isQuotaExceeded) return;

    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
      url.searchParams.append('liveChatId', this.liveChatId);
      url.searchParams.append('part', 'snippet,authorDetails');
      url.searchParams.append('key', this.apiKey);
      if (this.nextPollToken) {
        url.searchParams.append('pageToken', this.nextPollToken);
      }

      // liveChat.messages.list = 1 unit
      const resp = await fetch(url.toString());
      this.onQuotaUpdate(1);
      const data = await resp.json();

      if (data.error) {
         if (data.error.code === 403) {
            this.isQuotaExceeded = true;
            this.onStatusChange('error', 'API Quota Exceeded');
            return;
         }
         throw new Error(data.error.message);
      }

      this.nextPollToken = data.nextPageToken;
      this.pollInterval = Math.max(data.pollingIntervalMillis || 2000, 2000);

      if (data.items) {
        data.items.forEach((item: any) => {
          const msg: ChatMessage = {
            id: item.id,
            author: item.authorDetails.displayName,
            text: item.snippet.displayMessage,
            platform: 'youtube',
            timestamp: new Date(item.snippet.publishedAt),
            isRead: false,
            isFeatured: false,
            avatarUrl: item.authorDetails.profileImageUrl,
            authorColor: '#FF0000'
          };
          this.onMessage(msg);
        });
      }

      if (!this.isPaused) {
        this.timer = setTimeout(() => this.poll(), this.pollInterval);
      }
    } catch (e: any) {
      this.onStatusChange('error', e.message);
      this.timer = setTimeout(() => this.poll(), 10000);
    }
  }

  disconnect() {
    if (this.timer) clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
