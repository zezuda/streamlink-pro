
import { ChatMessage } from "../types";

export class YouTubeChatClient {
  private apiKey: string;
  private videoId: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: 'online' | 'error', error?: string) => void;
  private onQuotaUpdate: (units: number) => void;
  private onStatsUpdate?: (stats: { viewers: number }) => void;
  private liveChatId: string | null = null;
  private nextPollToken: string | null = null;
  private pollInterval: number = 10000; // Increased to 10s for quota optimization
  private timer: any = null;
  private statsTimer: any = null;
  private isPaused: boolean = false;
  private isQuotaExceeded: boolean = false;

  constructor(
    apiKey: string,
    videoId: string,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: 'online' | 'error', error?: string) => void,
    onQuotaUpdate: (units: number) => void,
    onStatsUpdate?: (stats: { viewers: number }) => void
  ) {
    this.apiKey = apiKey;
    this.videoId = this.extractVideoId(videoId);
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onQuotaUpdate = onQuotaUpdate;
    this.onStatsUpdate = onStatsUpdate;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.isPaused = true;
      if (this.timer) clearTimeout(this.timer);
      if (this.statsTimer) clearTimeout(this.statsTimer);
    } else {
      this.isPaused = false;
      if (this.liveChatId && !this.isQuotaExceeded) {
        this.poll();
        this.pollStats();
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
    } catch (e) { }
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
    this.pollStats();
  }

  private async pollStats() {
    if (this.isPaused || this.isQuotaExceeded) return;

    try {
      // videos.list = 1 unit
      // We poll stats every 60s to save quota
      const videoResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${this.videoId}&part=liveStreamingDetails&key=${this.apiKey}`);
      this.onQuotaUpdate(1);
      const videoData = await videoResp.json();

      if (videoData.items && videoData.items.length > 0) {
        const details = videoData.items[0].liveStreamingDetails;
        const viewers = parseInt(details?.concurrentViewers || '0', 10);
        if (this.onStatsUpdate) this.onStatsUpdate({ viewers });
      } else {
      }

      this.statsTimer = setTimeout(() => this.pollStats(), 60000);
    } catch (e) {
      console.error('[YouTube Stats] Error polling:', e);
      this.statsTimer = setTimeout(() => this.pollStats(), 60000);
    }
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
      // Enforce minimum 10s poll to save quota, unless API says longer
      this.pollInterval = Math.max(data.pollingIntervalMillis || 10000, 10000);

      if (data.items) {
        data.items.forEach((item: any) => {
          const snippet = item.snippet;
          let donationAmount = undefined;

          if (snippet.type === 'superChatEvent') {
            donationAmount = snippet.superChatDetails?.amountDisplayString;
          } else if (snippet.type === 'superStickerEvent') {
            donationAmount = snippet.superStickerDetails?.amountDisplayString;
          }

          const msg: ChatMessage = {
            id: item.id,
            author: item.authorDetails.displayName,
            text: snippet.displayMessage,
            platform: 'youtube',
            timestamp: new Date(snippet.publishedAt),
            isRead: false,
            isFeatured: false,
            avatarUrl: item.authorDetails.profileImageUrl,
            authorColor: '#FF0000',
            donationAmount
          };
          this.onMessage(msg);
        });
      }

      if (!this.isPaused) {
        this.timer = setTimeout(() => this.poll(), this.pollInterval);
      }
    } catch (e: any) {
      this.onStatusChange('error', e.message);
      this.timer = setTimeout(() => this.poll(), 20000); // Backoff on error
    }
  }

  disconnect() {
    if (this.timer) clearTimeout(this.timer);
    if (this.statsTimer) clearTimeout(this.statsTimer);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
