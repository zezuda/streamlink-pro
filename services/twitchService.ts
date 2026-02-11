import { ChatMessage } from "../types";

export class TwitchChatClient {
  private socket: WebSocket | null = null;
  private channel: string;
  private accessToken?: string;
  private clientId?: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatsUpdate?: (stats: { viewers: number }) => void;
  private onStatusChange?: (status: 'online' | 'error' | 'connecting', error?: string) => void;
  private statsTimer: any = null;

  // Resilience state
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private maxReconnectAttempts = 10;
  private isDisconnecting = false;

  constructor(
    channel: string,
    onMessage: (msg: ChatMessage) => void,
    onStatsUpdate?: (stats: { viewers: number }) => void,
    accessToken?: string,
    clientId?: string,
    onStatusChange?: (status: 'online' | 'error' | 'connecting', error?: string) => void
  ) {
    this.channel = channel.toLowerCase();
    this.onMessage = onMessage;
    this.onStatsUpdate = onStatsUpdate;
    this.accessToken = accessToken;
    this.clientId = clientId;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    this.isDisconnecting = false;
    this.clearTimers();

    if (this.onStatusChange) this.onStatusChange('connecting');

    try {
      // Use standard wss URL
      this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

      this.socket.onopen = () => {
        this.reconnectAttempts = 0; // Reset on success

        // Hardened handshake order: PASS -> NICK -> CAP REQ -> JOIN
        this.socket?.send('PASS SCHRODINGER');
        this.socket?.send('NICK justinfan' + Math.floor(Math.random() * 10000));
        this.socket?.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        this.socket?.send(`JOIN #${this.channel}`);

        if (this.onStatusChange) this.onStatusChange('online');

        if (this.accessToken && this.clientId) {
          this.pollStats();
        }
      };

      this.socket.onmessage = (event) => {
        const data = event.data as string;
        if (data.startsWith('PING')) {
          this.socket?.send('PONG :tmi.twitch.tv');
          return;
        }
        if (data.includes('PRIVMSG')) {
          const msg = this.parseTwitchMessage(data);
          if (msg) this.onMessage(msg);
        }
      };

      this.socket.onerror = (err) => {
        // Minimal error logging for user
        if (this.onStatusChange) this.onStatusChange('error', 'Connection failed. Retrying...');
        this.handleReconnect();
      };

      this.socket.onclose = () => {
        if (!this.isDisconnecting) {
          this.handleReconnect();
        }
      };

    } catch (e: any) {
      if (this.onStatusChange) this.onStatusChange('error', e.message);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.isDisconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        if (this.onStatusChange) this.onStatusChange('error', 'Cound not connect after multiple attempts.');
      }
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearTimers() {
    if (this.statsTimer) clearTimeout(this.statsTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private async pollStats() {
    if (!this.accessToken || !this.clientId) return;

    // Sanitize credentials: trim spaces and remove 'oauth:' prefix for Helix
    const trimmedToken = this.accessToken.trim();
    const trimmedClientId = this.clientId.trim();
    const sanitizedToken = trimmedToken.replace(/^oauth:/i, '');

    try {
      const resp = await fetch(`https://api.twitch.tv/helix/streams?user_login=${this.channel}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Client-ID': trimmedClientId,
          'Authorization': `Bearer ${sanitizedToken}`
        }
      });

      if (!resp.ok) return;

      const data = await resp.json();

      if (data.data && data.data.length > 0) {
        const viewers = data.data[0].viewer_count;
        if (this.onStatsUpdate) this.onStatsUpdate({ viewers });
      } else {
        if (this.onStatsUpdate) this.onStatsUpdate({ viewers: 0 });
      }

      this.statsTimer = setTimeout(() => this.pollStats(), 10000);
    } catch (e) {
      this.statsTimer = setTimeout(() => this.pollStats(), 10000);
    }
  }

  disconnect() {
    this.isDisconnecting = true;
    this.clearTimers();
    if (this.socket) {
      // Only close if it's OPEN. Closing in CONNECTING state can trigger browser warnings.
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      this.socket = null;
    }
  }

  private parseTwitchMessage(raw: string): ChatMessage | null {
    try {
      // Basic tag parsing
      const parts = raw.split(' ');
      const tagsStr = parts[0].startsWith('@') ? parts[0].slice(1) : '';
      const tags: Record<string, string> = {};
      tagsStr.split(';').forEach(t => {
        const [k, v] = t.split('=');
        tags[k] = v;
      });

      const userMatch = raw.match(/:(\w+)!/);
      const author = tags['display-name'] || (userMatch ? userMatch[1] : 'Unknown');
      const textMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)/);
      const text = textMatch ? textMatch[1].trim() : '';

      if (!text) return null;

      // first-msg=1 indicates a first-time chat
      const isFirstMessage = tags['first-msg'] === '1';

      // Check for bits (Cheer)
      const bits = tags['bits'];
      let donationAmount = undefined;
      if (bits) {
        donationAmount = `${bits} Bits`;
      }

      return {
        id: tags['id'] || Math.random().toString(36).substr(2, 9),
        author,
        text,
        platform: 'twitch',
        timestamp: new Date(),
        isRead: false,
        isFeatured: false,
        isFirstMessage,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${author}`,
        authorColor: tags['color'] || '#9146FF',
        donationAmount
      };
    } catch (e) {
      return null;
    }
  }
}
