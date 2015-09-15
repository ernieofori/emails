// Generated by CoffeeScript 1.9.3
var Acccount, Mailbox, Message, Scheduler, SocketHandler, _, forgetClient, handleNewClient, inScope, io, ioServer, log, processSummaryCooldown, ramStore, sockets, stream, updateClientScope,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

log = require('../utils/logging')('sockethandler');

ioServer = require('socket.io');

ramStore = require('../models/store_account_and_boxes');

Scheduler = require('../processes/_scheduler');

stream = require('stream');

_ = require('lodash');

Acccount = require('../models/account');

Mailbox = require('../models/mailbox');

Message = require('../models/message');

io = null;

sockets = [];

processSummaryCooldown = null;

SocketHandler = exports;

SocketHandler.setup = function(app, server) {
  var onAccountChanged, onAccountChangedDebounced;
  io = ioServer(server);
  io.on('connection', handleNewClient);
  Acccount.on('create', function(created) {
    created = ramStore.getAccountClientObject(created.id);
    return io.emit('account.create', created);
  });
  Acccount.on('update', function(updated, old) {
    updated = ramStore.getAccountClientObject(updated.id);
    return io.emit('account.update', updated, old);
  });
  Acccount.on('delete', function(id, deleted) {
    return io.emit('account.delete', id, deleted);
  });
  Mailbox.on('create', function(created) {
    created = ramStore.getMailboxClientObject(created.id);
    return io.emit('mailbox.create', created);
  });
  Mailbox.on('update', function(updated, old) {
    updated = ramStore.getMailboxClientObject(updated.id);
    return io.emit('mailbox.update', updated, old);
  });
  Mailbox.on('delete', function(id, deleted) {
    return io.emit('mailbox.delete', id, deleted);
  });
  Message.on('create', function(created) {
    var i, len, results, socket;
    created = created.toClientObject();
    io.emit('message.create', created);
    results = [];
    for (i = 0, len = sockets.length; i < len; i++) {
      socket = sockets[i];
      if (inScope(socket, created)) {
        results.push(socket.emit('message.create', created));
      }
    }
    return results;
  });
  Message.on('update', function(updated, old) {
    var i, len, results, socket;
    updated = updated.toClientObject();
    io.emit('message.update', updated, old);
    results = [];
    for (i = 0, len = sockets.length; i < len; i++) {
      socket = sockets[i];
      if (inScope(socket, updated) || inScope(socket, old)) {
        results.push(socket.emit('message.update', updated));
      } else {
        results.push(void 0);
      }
    }
    return results;
  });
  Message.on('delete', function(id, deleted) {
    return io.emit('message.delete', id, deleted);
  });
  Scheduler.on('change', function() {
    if (processSummaryCooldown) {
      return true;
    } else {
      io.emit('refresh.update', Scheduler.clientSummary());
      processSummaryCooldown = true;
      return setTimeout((function() {
        return processSummaryCooldown = false;
      }), 500);
    }
  });
  onAccountChanged = function(accountID) {
    var updated;
    updated = ramStore.getAccountClientObject(accountID);
    if (updated) {
      return io.emit('account.update', updated);
    }
  };
  onAccountChangedDebounced = _.debounce(onAccountChanged, 500, {
    leading: true,
    trailing: true
  });
  return ramStore.on('change', onAccountChangedDebounced);
};

inScope = function(socket, data) {
  var ref;
  return (ref = socket.scope_mailboxID, indexOf.call(Object.keys(data.mailboxIDs), ref) >= 0) && socket.scope_before < data.date;
};

handleNewClient = function(socket) {
  log.debug('handleNewClient', socket.id);
  socket.emit('refreshes.status', Scheduler.clientSummary());
  socket.on('change_scope', function(scope) {
    return updateClientScope(socket, scope);
  });
  socket.on('disconnect', function() {
    return forgetClient(socket);
  });
  return sockets.push(socket);
};

updateClientScope = function(socket, scope) {
  log.debug('updateClientScope', socket.id, scope);
  socket.scope_before = new Date(scope.before || 0);
  return socket.scope_mailboxID = scope.mailboxID;
};

forgetClient = function(socket) {
  var index;
  log.debug("forgetClient", socket.id);
  index = sockets.indexOf(socket);
  if (index !== -1) {
    return sockets = sockets.splice(index, 1);
  }
};
