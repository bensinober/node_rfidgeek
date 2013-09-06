// WEBSOCKET SERVER
var WebSocketServer = require('websocket').server;
var http = require('http');
var connections = [];

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
  httpServer: server,
  // You should not use autoAcceptConnections for production
  // applications, as it defeats all standard cross-origin protection
  // facilities built into the protocol and the browser.  You should
  // *always* verify the connection's origin and decide whether or not
  // to accept it.
  autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
  console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

  // accept connection - you should check 'request.origin' to make sure that
  // client is connecting from your website
  // (http://en.wikipedia.org/wiki/Same_origin_policy)
  var connection = request.accept(null, request.origin); 
  connections.push(connection);
  console.log(connection.remoteAddress + " connected - Protocol Version " + connection.webSocketVersion);

  connection.on('message', function(message) {
    if (message.type === 'utf8') { // accept only text
      console.log((new Date()) + ' message: ' + message.utf8Data);
      // rebroadcast command to all clients
      connections.forEach(function(destination) {
          destination.sendUTF(message.utf8Data);
      });
    }
  });

  // Handle closed connections
  connection.on('close', function() {
    console.log(connection.remoteAddress + " disconnected");
    var index = connections.indexOf(connection);
    if (index !== -1) {
      // remove the connection from the pool
      connections.splice(index, 1);
    }
  });
});

module.exports = wsServer;
