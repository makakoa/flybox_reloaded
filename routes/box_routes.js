'use strict';

var fillerImap = {
  user: 'flybox4real@gmail.com',
  password: 'flyboxme',
  host: 'imap.gmail.com',
  port: 993,
  tls: true
}; //TODO remove

var Box = require('../models/box');
var Post = require('../models/post');
var key = require('../lib/key_gen');
var mailer = require('../lib/mailer');
var fetcher = require('../lib/fetcher');

module.exports = function(app, jwtAuth) {
  // get single box
  app.get('/api/boxes/:boxKey', jwtAuth, function(req, res) {
    console.log('Getting box ' + req.params.boxKey + ' for ' + req.params.email);
    var user = getCurrent(req.user);
    Box.findOne({boxKey: req.params.boxKey,
              members: {$elemMatch: {email: user}}})
    .populate('thread')
    .exec(function(err, data) {
      if (err) handle(err, res);
      var response = {
        box: data,
        name: user
      };
      res.json(response);
    });
  });

  // add member to box
  app.post('/api/boxes/:boxKey', jwtAuth, function(req, res) {
    console.log('Adding ' + req.body.email + ' to ' + req.params.boxKey);
    var user = getCurrent(req.user);
    Box.findOne({boxKey: req.params.boxKey,
              members: {$elemMatch: {email: user}}}, function(err, box) {
      if (err) handle(err, res);
      box.members.push({
        email: req.body.email,
        unread: 1
      });
      box.save(function(err) {
        if (err) handle(err, res);
        res.json({msg: 'member added'});
      });
    });
  });

  // leave box
  app.delete('/api/boxes/:boxKey', jwtAuth, function(req, res) {
    console.log(req.user.email + ' leaving ' + req.params.boxKey);
    var user = getCurrent(req.user);
    Box.findOne({boxKey: req.params.boxKey,
              members: {$elemMatch: {email: user}}}, function(err, box) {
      if (err) handle(err, res);
      box.members.forEach(function(member) {
        if (member.email === user) {
          member.remove();
        }
      });
      box.save(function(err) {
        if (err) handle(err, res);
        res.json({msg: 'left box'});
      });
    });
  });

  // get inbox
  app.get('/api/boxes', jwtAuth, function(req, res) {
    var user = getCurrent(req.user);
    console.log('getting inbox for ' + user);
    var boxes = [];
    Box.find({members: {$elemMatch: {email: user}}}, function(err, data) {
      if (err) handle(err, res);
      data.forEach(function(box) {
        var num;
        box.members.forEach(function(member) {
          if (user === member.email) {
            num = member.unread;
            return;
          }
        });
        boxes.push({
          email: box.members[0].email,
          subject: box.subject,
          date: box.date,
          boxKey: box.boxKey,
          unread: num,
          isBox: true
        });
      });
      var accounts = [];
      for (var i = 0; i < req.user.smtps.length; i++) {
        accounts.push({
          name: req.user.smtps[i].auth.user,
          number: i
        });
      }
      var response = {
        user: {name: user},
        current: user,
        accounts: accounts,
        inbox: boxes
      };
      res.json(response);
    });
  });

  //send box
  app.post('/api/boxes', jwtAuth, function(req, res) {
    console.log('post route hit');
    var user = getCurrent(req.user);
    var post = new Post();
    post.content = req.body.post;
    post.by = user;
    post.save(function(err) {
      if (err) handle(err, res);
    });
    var box = new Box();
    try {
      box.subject = req.body.subject;
      box.boxKey = key();
      box.members = [{email: user, unread: 0}];
      req.body.members.forEach(function(member) {
        box.members.push({email: member, unread: 1});
      });
      box.thread = [post._id];
    } catch (err) {
      handle(err, res);
    }
    box.save(function(err) {
      if (err) handle(err, res);
      console.log('box posted');
      //add checker for flybox user here
      var mailOptions = {
        from: req.user.displayName + '<' + user + '>',
        to: req.body.members,
        subject: box.subject,
        text: post.content
      };
      var smtpOptions = {
        service: 'gmail',
        auth: {
          user: 'flybox4real@gmail.com',
          pass: 'flyboxme'
        }
      };
      mailer(mailOptions, smtpOptions);

      res.json({msg: 'sent!'});
    });
  });

  // import emails
  app.get('/api/emails/import', jwtAuth, function(req, res) {
    fetcher.getMail(fillerImap, function(inbox) {
      inbox.forEach(function(mail) {
        var post = new Post();
        post.content = mail.text;
        post.by = mail.from[0].address;
        post.date = mail.date;
        post.save(function(err) {
          if (err) handle(err, res);
        });
        var box = new Box();
        try {
          box.subject = mail.subject;
          box.boxKey = key();
          box.members = [{email: mail.from[0].address, unread: 0}, {email: mail.to[0].address, unread: 0}];
          box.thread = [post._id];
        } catch (err) {
          handle(err, res);
        }
        box.save(function(err) {
          if (err) handle(err, res);
          console.log('box posted to ' + mail.to[0].address);
        });
      });
    });
  });

  var handle = function(err, res) {
    console.log(err);
    return res.status(500).send('Box Error');
  };

  var getCurrent = function(user) {
    var currently = user.email;
    if (user.smtps.length > 0 && user.current) currently = user.smtps[user.current].auth.user;
    return currently;
  };
};
