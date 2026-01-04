const { io } = require('socket.io-client');

class WordBombAddon {
  constructor(token, options = {}) {
    this.token = token;
    this.name = options.name || 'My Addon';
    this.desc = options.desc || '';
    this.practice = options.practice || false;
    this.welcome = options.welcome || '';
    this.permissions = options.permissions || [];
    this.socket = null;
    this.addonId = null;
    this.clients = new Map();
    this.handlers = {};
    this.commands = new Map();
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
    this.socket = io('https://ws.wordbomb.io', {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      this.emit('connected');
      this.socket.emit('addon-register', {
        token: this.token,
        name: this.name,
        desc: this.desc,
        practice: this.practice,
        welcome: this.welcome,
        commands: Array.from(this.commands.keys()),
        permissions: this.permissions
      });
    });

    this.socket.on('addon-result', (data) => {
      if (data.ok) {
        this.addonId = data.id;
        this.emit('ready', data.id);
      } else {
        this.emit('error', data.err);
      }
    });

    this.socket.on('client-register', (data) => {
      this.clients.set(data.id, {
        id: data.id,
        name: data.name,
        session: data.session
      });
      this.emit('register', { id: data.id, name: data.name }, data.session);
    });

    this.socket.on('client-unregister', (data) => {
      this.clients.delete(data.id);
      this.emit('unregister', { id: data.id, name: data.name });
    });

    this.socket.on('client-connect', (data) => {
      this.clients.set(data.id, {
        id: data.id,
        name: data.name,
        session: data.session
      });
      this.emit('connect', { id: data.id, name: data.name }, data.session);
    });

    this.socket.on('client-disconnect', (data) => {
      this.clients.delete(data.id);
      this.emit('disconnect', { id: data.id, name: data.name });
    });

    this.socket.on('event', (data) => {
      const client = this.clients.get(data.client);
      if (!client) return;

      if (data.event === 'command') {
        const handler = this.commands.get(data.data.command);
        if (handler) handler(client, data.data.args || '');
        return;
      }

      const event = data.event.startsWith('g:') ? data.event.slice(2) : data.event;

      if (this.handlers[event]) {
        this.handlers[event](data.data, client);
      }
    });

    this.socket.on('disconnect', (reason) => this.emit('offline', reason));
    this.socket.on('connect_error', (err) => this.emit('error', err.message));

    return this;
  }

  emit(event, ...args) {
    if (this.handlers[event]) {
      this.handlers[event](...args);
    }
  }

  send(clientId, event, data) {
    if (!this.socket) return;
    this.socket.emit('addon-send', {
      to: clientId,
      event,
      data
    });
  }

  sendChat(clientId, message) {
    this.send(clientId, 'chat', { message });
  }

  sendEmbed(clientId, embed) {
    this.send(clientId, 'embed', embed);
  }

  broadcast(event, data) {
    if (!this.socket) return;
    this.socket.emit('addon-broadcast', {
      event,
      data
    });
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
    if (!this.socket) return Promise.reject('No socket');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject('Timeout'), 10000);
      this.socket.once('addon-dm-result', (data) => {
        clearTimeout(timeout);
        if (data.ok) resolve();
        else reject(data.err || 'Failed');
      });
      this.socket.emit('addon-dm', { to: clientId, message });
    });
  }

  sendDiscordFile(clientId, fileName, fileContent) {
    if (!this.socket) return Promise.reject('No socket');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject('Timeout'), 10000);
      this.socket.once('addon-dm-result', (data) => {
        clearTimeout(timeout);
        if (data.ok) resolve();
        else reject(data.err || 'Failed');
      });
      this.socket.emit('addon-dm', { to: clientId, fileName, fileContent });
    });
  }
}

module.exports = { WordBombAddon };
