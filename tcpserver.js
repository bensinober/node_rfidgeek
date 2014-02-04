/*
 * Simple TCP Socket server
 */

var net = require('net');
var responseString = '';

var server = net.createServer(function(socket) { //'connection' listener
  console.log('Connected: ' + socket.remoteAddress + ':' + socket.remotePort); 
  socket.setEncoding("utf8");

  socket.on('data', function(data) {
    console.log(data);

    if (data == "\n") {
      console.log(responseString);
      var json = JSON.parse(responseString);
      responseString = '';
    } else {
      responseString += data;
    }
  });
  socket.on('end', function() {
    console.log('client disconnected');
  });
  socket.write('{"hello":"msg"}');
  socket.write('\n');
});

server.listen(4444, function() { //'listening' listener
  console.log('server bound');
});