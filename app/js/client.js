'use strict';

require('angular/angular');
require('angular-route');
require('angular-cookies');
require('angular-base64');
window.io = require('socket.io-client/socket.io');
require('angular-socket-io');

var app = angular.module('flyboxApp', ['ngRoute', 'ngCookies', 'base64', 'btford.socket-io']);

require('./services/socket_service')(app);
require('./users/users')(app);
require('./inbox/inbox')(app);
require('./compose/compose')(app);
require('./box/box')(app);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'templates/login.html',
      controller: 'UsersCtrl'
    })
    .when('/inbox/', {
      templateUrl: 'templates/inbox.html',
      controller: 'InboxCtrl'
    })
    .when('/compose/', {
      templateUrl: 'templates/compose.html',
      controller: 'ComposeCtrl'
    })
    .when('/box/:boxId/', {
      templateUrl: 'templates/box.html',
      controller: 'BoxCtrl'
    })
    .otherwise({
      redirectTo: '/'
    });
}]);