const WebSocket = require('ws');

class WordBombAddon {
  constructor(token, options = {}) {
    this.token = token;
    this.name = options.name || 'My Addon';
    this.desc = options.desc || '';
    this.practice = options.practice || false;
    this.welcome = options.welcome || '';
    this.permissions = options.permissions || [];
    this.ws = null;
    this.addonId = null;
    this.clients = new Map();
    this.handlers = {};
    this.commands = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.pendingCallbacks = new Map();
    this.callbackId = 0;
    setTimeout(() => this.connect(), 0);
  }

  on(event, handler) {
    this.handlers[event] = handler;
    return this;
  }

  registerCommand(name, handler) {
    const cmd = name.startsWith('/') ? name.slice(1) : name;
    this.commands.set(cmd, handler);
    return this;
  }

  connect() {
    this.ws = new WebSocket('wss://ws.wordbomb.io');

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.sendEvent('addon-register', {
        token: this.token,
        name: this.name,
        desc: this.desc,
        practice: this.practice,
        welcome: this.welcome,
        commands: Array.from(this.commands.keys()),
        permissions: this.permissions
      });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const event = msg.e;
        const payload = msg.d;

        if (event === 'addon-result') {
          if (payload.ok) {
            this.addonId = payload.id;
            this.emit('ready', payload.id);
          } else {
            this.emit('error', payload.err);
          }
          return;
        }

        if (event === 'client-register') {
          this.clients.set(payload.id, {
            id: payload.id,
            name: payload.name,
            session: payload.session
          });
          this.emit('register', { id: payload.id, name: payload.name }, payload.session);
          return;
        }

        if (event === 'client-unregister') {
          this.clients.delete(payload.id);
          this.emit('unregister', { id: payload.id, name: payload.name });
          return;
        }

        if (event === 'client-connect') {
          this.clients.set(payload.id, {
            id: payload.id,
            name: payload.name,
            session: payload.session
          });
          this.emit('connect', { id: payload.id, name: payload.name }, payload.session);
          return;
        }

        if (event === 'client-disconnect') {
          this.clients.delete(payload.id);
          this.emit('disconnect', { id: payload.id, name: payload.name });
          return;
        }

        if (event === 'event') {
          const client = this.clients.get(payload.client);
          if (!client) return;

          if (payload.event === 'command') {
            const handler = this.commands.get(payload.data.command);
            if (handler) handler(client, payload.data.args || '');
            return;
          }

          const evtName = payload.event.startsWith('g:') ? payload.event.slice(2) : payload.event;
          if (this.handlers[evtName]) {
            this.handlers[evtName](payload.data, client);
          }
          return;
        }

        if (event === 'addon-dm-result') {
          const cb = this.pendingCallbacks.get('dm');
          if (cb) {
            this.pendingCallbacks.delete('dm');
            if (payload.ok) cb.resolve();
            else cb.reject(payload.err || 'Failed');
          }
          return;
        }
      } catch {}
    });

    this.ws.on('close', (code, reason) => {
      this.emit('offline', reason?.toString() || 'Connection closed');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this.emit('error', err.message);
    });

    return this;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', 'Max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    setTimeout(() => this.connect(), delay);
  }

  emit(event, ...args) {
    if (this.handlers[event]) {
      this.handlers[event](...args);
    }
  }

  sendEvent(event, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ e: event, d: data }));
    } catch {}
  }

  send(clientId, event, data) {
    this.sendEvent('addon-send', { to: clientId, event, data });
  }

  sendChat(clientId, message) {
    this.send(clientId, 'chat', { message });
  }

  sendEmbed(clientId, embed) {
    this.send(clientId, 'embed', embed);
  }

  broadcast(event, data) {
    this.sendEvent('addon-broadcast', { event, data });
  }

  broadcastChat(message) {
    this.broadcast('chat', { message });
  }

  getClients() {
    return Array.from(this.clients.values());
  }

  getClient(id) {
    return this.clients.get(id);
  }

  sendDiscordMessage(clientId, message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject('No connection');
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete('dm');
        reject('Timeout');
      }, 10000);
      this.pendingCallbacks.set('dm', { resolve: () => { clearTimeout(timeout); resolve(); }, reject: (err) => { clearTimeout(timeout); reject(err); } });
      this.sendEvent('addon-dm', { to: clientId, message });
    });
  }

  sendDiscordFile(clientId, fileName, fileContent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject('No connection');
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete('dm');
        reject('Timeout');
      }, 10000);
      this.pendingCallbacks.set('dm', { resolve: () => { clearTimeout(timeout); resolve(); }, reject: (err) => { clearTimeout(timeout); reject(err); } });
      this.sendEvent('addon-dm', { to: clientId, fileName, fileContent });
    });
  }
}

module.exports = { WordBombAddon };
