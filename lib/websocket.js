/*
 * Simple WebSocket Handler
 * Handles I/O from external socket to rfidGeek module
 * {"cmd": "ALARM-ON"}
 * {"cmd": "ALARM-OFF"}
 * {"cmd": "SCAN-ON"}
 * {"cmd": "SCAN-OFF"}
 * {"cmd": "WRITE", "data", "<bytes>"}
 */

var WebSocketServer = require('ws').Server

function WebSocket(rfid,logger) {
  var self = this;
  PORT = rfid.config.websocket.port || 4444
  HOST = rfid.config.websocket.host || 'localhost'

  var wss = new WebSocketServer({port: PORT, host: HOST});

  self.server = wss.on('connection', function(socket) {
    logger.log('info', 'Client connected: ' + socket.remoteAddress + ':' + socket.remotePort); 
    socket.on('message', function(data) {
      //console.log('received: %s', data);

      try {
        var json = JSON.parse(data.toString("UTF8"));
        switch(json.cmd) {
          case 'ALARM-ON':
            logger.log('debug', 'Activating alarms');
            rfid.activateAFI(function(err, result) {
              if(err) {
                logger.log('debug', result);
                socket.send('{"cmd": "ALARM-ON", "status": "FAILED"}\n');
              } else {
                socket.send('{"cmd": "ALARM-ON", "status": "OK"}\n');
              }
            });
            break;
          case 'ALARM-OFF':
            logger.log('debug', 'Deactivating alarms');
            rfid.deactivateAFI(function(err, result) {
              if(err) {
                logger.log('error', err);
                socket.send('{"cmd": "ALARM-OFF", "status": "FAILED"}\n');
              } else {
                logger.log('debug', result);
                socket.send('{"cmd": "ALARM-OFF", "status": "OK"}\n');
              }
            });
            break;
          case 'SCAN-ON':
            logger.log('debug', 'Starting scanning for tags');
            rfid.startScan(function(err) {
              if(err) {
                logger.log('error', err);
                socket.send('{"cmd": "SCAN-ON", "status": "FAILED"}\n');
              } else {
                socket.send('{"cmd": "SCAN-ON", "status": "OK"}\n');
              }          
            });
            break;
          case 'SCAN-OFF':
          logger.log('debug', 'Stopping scanning for tags');
            rfid.stopScan();
            socket.send('{"cmd": "SCAN-OFF", "status": "OK"}\n');
            rfid.tagsInRange = [];
            break;
          case 'WRITE':
            logger.log('debug', 'Writing to tag: '+id+', data: '+data);
            rfid.writeISO15693(id, data, function(err) {
              if(err) {
                logger.log('error', err);
                socket.send('{"cmd": "WRITE", "status": "FAILED"}\n');
              } else {
                socket.send('{"cmd": "WRITE", "status": "OK"}\n');
              }          
            });
            break;
          default:
            logger.log('error', 'unknown command sent: '+JSON.stringify(json));
            socket.send('{"cmd": "UNKNOWN", "status": "FAILED"}\n');
        } 
      } catch (e) {
        logger.log("error", e);
      }
    });

    socket.send('{"hello":"you"}\n');
    self.server.emit('ready', socket);    // emit ready to allow rfidgeek to grab socket

    socket.on('end', function() {
      logger.log('info', 'client disconnected');
      rfid.socket = undefined;
    });

    socket.on('error', function(err) {
      logger.log('error', err.message);
    });
  });
}

module.exports = WebSocket;
