import { ChatMessage, HypeTrainData } from "../types";

export class TwitchChatClient {
  private socket: WebSocket | null = null;
  private channel: string;
  private accessToken?: string;
  private clientId?: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatsUpdate?: (stats: { viewers: number }) => void;
  private onHypeTrainUpdate?: (hypeTrain: HypeTrainData | null) => void;
  private onStatusChange?: (status: 'online' | 'error' | 'connecting', error?: string) => void;
  private statsTimer: any = null;
  private hypeTrainTimer: any = null;

  // Resilience state
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private maxReconnectAttempts = 10;
  private isDisconnecting = false;

  constructor(
    channel: string,
    onMessage: (msg: ChatMessage) => void,
    onStatsUpdate?: (stats: { viewers: number }) => void,
    onHypeTrainUpdate?: (hypeTrain: HypeTrainData | null) => void,
    accessToken?: string,
    clientId?: string,
    onStatusChange?: (status: 'online' | 'error' | 'connecting', error?: string) => void
  ) {
    this.channel = channel.toLowerCase();
    this.onMessage = onMessage;
    this.onStatsUpdate = onStatsUpdate;
    this.onHypeTrainUpdate = onHypeTrainUpdate;
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
          if (this.onHypeTrainUpdate) this.pollHypeTrain();
        }
      };

      this.socket.onmessage = (event) => {
        const data = event.data as string;
        if (data.startsWith('PING')) {
          this.socket?.send('PONG :tmi.twitch.tv');
          return;
        }
        if (data.includes('PRIVMSG') || data.includes('USERNOTICE')) {
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
    if (this.hypeTrainTimer) clearTimeout(this.hypeTrainTimer);
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

  private async pollHypeTrain() {
    if (!this.accessToken || !this.clientId || !this.onHypeTrainUpdate) return;

    const trimmedToken = this.accessToken.trim().replace(/^oauth:/i, '');
    const trimmedClientId = this.clientId.trim();

    try {
      let broadcasterId = '';
      const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${this.channel}`, {
        headers: { 'Client-ID': trimmedClientId, 'Authorization': `Bearer ${trimmedToken}` }
      });
      if (userResp.ok) {
        const userData = await userResp.json();
        if (userData.data && userData.data.length > 0) {
          broadcasterId = userData.data[0].id;
        }
      }

      if (!broadcasterId) {
        this.hypeTrainTimer = setTimeout(() => this.pollHypeTrain(), 60000);
        return;
      }

      const resp = await fetch(`https://api.twitch.tv/helix/hypetrain/status?broadcaster_id=${broadcasterId}`, {
        cache: 'no-store',
        headers: {
          'Client-ID': trimmedClientId,
          'Authorization': `Bearer ${trimmedToken}`
        }
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          console.warn("Twitch Hype Train 401/403: Missing scope channel:read:hype_train?");
          if (this.onStatusChange) this.onStatusChange('error', "Hype Train: Missing 'channel:read:hype_train' scope.");
          // Don't retry immediately to avoid spamming if the token is bad
          this.hypeTrainTimer = setTimeout(() => this.pollHypeTrain(), 120000);
          return;
        }
        this.hypeTrainTimer = setTimeout(() => this.pollHypeTrain(), 30000);
        return;
      }

      const data = await resp.json();

      if (!data.data || data.data.length === 0) {
        this.onHypeTrainUpdate(null);
      } else {
        const train = data.data[0];
        const expiresAt = new Date(train.expires_at).getTime();
        const now = Date.now();

        if (expiresAt > now) {
          this.onHypeTrainUpdate({
            id: train.id,
            level: train.level,
            progress: train.progress,
            goal: train.goal,
            total: train.total,
            isActive: true,
            expiryDate: new Date(train.expires_at)
          });
        } else {
          this.onHypeTrainUpdate(null);
        }
      }

      this.hypeTrainTimer = setTimeout(() => this.pollHypeTrain(), 10000);
    } catch (e) {
      this.hypeTrainTimer = setTimeout(() => this.pollHypeTrain(), 30000);
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

      let text = '';
      const privMsgMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)/);
      if (privMsgMatch) {
        text = privMsgMatch[1].trim();
      }

      // Handle USERNOTICE (Subs, Resubs, Gifts)
      const isUserNotice = raw.includes('USERNOTICE');
      let eventType: 'chat' | 'donation' | 'subscription' = 'chat';
      let subscriptionData = undefined;

      if (isUserNotice) {
        const msgId = tags['msg-id']; // sub, resub, subgift, anonsubgift, submysterygift, giftpaidupgrade, rewardgift, raid, unraid, ritual, bitsbadgetier

        // We only care about subs for now
        if (['sub', 'resub', 'subgift', 'anonsubgift'].includes(msgId)) {
          eventType = 'subscription';
          const plan = tags['msg-param-sub-plan'];
          const months = parseInt(tags['msg-param-cumulative-months'] || '0') || parseInt(tags['msg-param-months'] || '0') || 1;
          const isGift = msgId.includes('gift');
          const gifter = tags['login']; // or display-name?

          subscriptionData = {
            plan,
            months,
            isGift,
            gifter: isGift ? tags['display-name'] || tags['login'] : null
          };

          // System message is usually in the `system-msg` tag, replacing spaces with \s
          const systemMsg = tags['system-msg'] ? tags['system-msg'].replace(/\\s/g, ' ') : '';

          // If there is a user message attached, it comes after the second colon usually, but USERNOTICE parsing is tricky.
          // raw: @tags :tmi.twitch.tv USERNOTICE #channel :Optional Message
          const userNoticeMatch = raw.match(/USERNOTICE #[^ ]+ :(.+)/);
          if (userNoticeMatch) {
            text = userNoticeMatch[1].trim();
          } else {
            // specific case: no user message, just system message
            text = systemMsg;
          }

          // If still empty (shouldn't happen for sub notifications usually having system-msg), fallback
          if (!text) text = `${author} subscribed!`;
        } else {
          // Ignore other usernotices for now (like raids) or treat as chat?
          // Let's treat as chat or null.
          // Ideally we want to show Raids too? Maybe later.
          // For now, if it's not a sub, return null to avoid clutter.
          return null;
        }
      }

      if (!text && eventType === 'chat') return null;

      // first-msg=1 indicates a first-time chat
      const isFirstMessage = tags['first-msg'] === '1';

      // Check for bits (Cheer)
      const bits = tags['bits'];
      let donationAmount = undefined;
      if (bits) {
        donationAmount = `${bits} Bits`;
        eventType = 'donation';
      }

      return {
        id: tags['id'] || Math.random().toString(36).substr(2, 9),
        author,
        text,
        platform: 'twitch',
        eventType,
        subscription: subscriptionData,
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
