// Generated by CoffeeScript 1.9.3
var Account, BadRequest, Mailbox, MailboxRefreshFast, Message, Scheduler, _, async, log, ramStore;

async = require('async');

Account = require('../models/account');

Mailbox = require('../models/mailbox');

Message = require('../models/message');

BadRequest = require('../utils/errors').BadRequest;

log = require('../utils/logging')({
  prefix: 'mailbox:controller'
});

_ = require('lodash');

async = require('async');

ramStore = require('../models/store_account_and_boxes');

Scheduler = require('../processes/_scheduler');

MailboxRefreshFast = require('../processes/mailbox_refresh_fast');

module.exports.refresh = function(req, res, next) {
  var account, mailbox;
  mailbox = ramStore.getMailbox(req.params.mailboxID);
  account = ramStore.getAccount(mailbox.accountID);
  if (!account.supportRFC4551) {
    return next(new BadRequest('Cant refresh a non RFC4551 box'));
  } else {
    return res.send(ramStore.getMailboxClientObject(mailbox.id));
  }
};

module.exports.create = function(req, res, next) {
  var account, label, mailbox, parent, path, tree;
  log.info(("Creating " + req.body.label + " under " + req.body.parentID) + (" in " + req.body.accountID));
  account = ramStore.getAccount(req.body.accountID);
  parent = ramStore.getMailbox(req.body.parentID);
  label = req.body.label;
  if (parent) {
    path = parent.path + parent.delimiter + label;
    tree = parent.tree.concat(label);
  } else {
    path = label;
    tree = [label];
  }
  mailbox = {
    accountID: account.id,
    label: label,
    path: path,
    tree: tree,
    delimiter: (parent != null ? parent.delimiter : void 0) || '/',
    attribs: []
  };
  return async.series([
    function(cb) {
      return ramStore.getImapPool(mailbox).doASAP(function(imap, cbRelease) {
        return imap.addBox2(path, cbRelease);
      }, cb);
    }, function(cb) {
      return Mailbox.create(mailbox, function(err, created) {
        mailbox = created;
        return cb(err);
      });
    }
  ], function(err) {
    if (err) {
      return next(err);
    }
    return res.send(ramStore.getAccountClientObject(account.id));
  });
};

module.exports.update = function(req, res, next) {
  var account, favorites, mailbox, newPath, parentPath, path;
  log.info("Updating " + req.params.mailboxID + " to " + req.body.label);
  mailbox = ramStore.getMailbox(req.params.mailboxID);
  account = ramStore.getAccount(mailbox.accountID);
  if (req.body.label) {
    if (req.body.label === mailbox.label) {
      log.info("No update performed label is the same.");
      return res.send(ramStore.getAccountClientObject(account.id));
    } else {
      path = mailbox.path;
      parentPath = path.substring(0, path.lastIndexOf(mailbox.label));
      newPath = parentPath + req.body.label;
      return mailbox.imapcozy_rename(req.body.label, newPath, function(err, updated) {
        if (err) {
          return next(err);
        }
        return res.send(ramStore.getAccountClientObject(account.id));
      });
    }
  } else if (req.body.favorite != null) {
    favorites = _.without(account.favorites, mailbox.id);
    if (req.body.favorite) {
      favorites.push(mailbox.id);
    }
    return account.updateAttributes({
      favorites: favorites
    }, function(err, updated) {
      if (err) {
        return next(err);
      }
      return res.send(ramStore.getAccountClientObject(account.id));
    });
  } else {
    return next(new BadRequest('Unsuported request for mailbox update'));
  }
};

module.exports["delete"] = function(req, res, next) {
  var account, mailbox;
  log.info("Deleting " + req.params.mailboxID);
  mailbox = ramStore.getMailbox(req.params.mailboxID);
  account = ramStore.getAccount(mailbox.accountID);
  return mailbox.imapcozy_delete(function(err) {
    if (err) {
      return next(err);
    }
    return res.send(ramStore.getAccountClientObject(account.id));
  });
};

module.exports.expunge = function(req, res, next) {
  var account, mailbox;
  log.info("Expunging " + req.params.mailboxID);
  mailbox = ramStore.getMailbox(req.params.mailboxID);
  account = ramStore.getAccount(mailbox.accountID);
  if (account.trashMailbox === req.params.mailboxID) {
    return mailbox.imap_expungeMails(function(err) {
      if (err) {
        return next(err);
      }
      return res.send(ramStore.getAccountClientObject(account.id));
    });
  } else {
    return next(new BadRequest('You can only expunge trash mailbox'));
  }
};
