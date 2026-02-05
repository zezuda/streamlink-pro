
import { ChatMessage } from "../types";

export class TwitchChatClient {
  private socket: WebSocket | null = null;
  private channel: string;
  private onMessage: (msg: ChatMessage) => void;

  constructor(channel: string, onMessage: (msg: ChatMessage) => void) {
    this.channel = channel.toLowerCase();
    this.onMessage = onMessage;
  }

  connect() {
    this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.socket.onopen = () => {
      this.socket?.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this.socket?.send('PASS SCHRODINGER'); // Anonymous
      this.socket?.send('NICK justinfan' + Math.floor(Math.random() * 10000));
      this.socket?.send(`JOIN #${this.channel}`);
      console.log(`Connected to Twitch channel: ${this.channel}`);
    };

    this.socket.onmessage = (event) => {
      const data = event.data as string;
      
      // Keep-alive
      if (data.startsWith('PING')) {
        this.socket?.send('PONG :tmi.twitch.tv');
        return;
      }

      // Parse PRIVMSG
      if (data.includes('PRIVMSG')) {
        const msg = this.parseTwitchMessage(data);
        if (msg) this.onMessage(msg);
      }
    };

    this.socket.onclose = () => {
      console.log('Twitch WebSocket closed');
    };
  }

  disconnect() {
    this.socket?.close();
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
        authorColor: tags['color'] || '#9146FF'
      };
    } catch (e) {
      console.error("Error parsing Twitch message", e);
      return null;
    }
  }
}
