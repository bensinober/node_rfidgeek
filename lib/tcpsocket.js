/*
 * Simple TCP Socket Server
 * Handles I/O from external socket to rfidGeek module
 * {"cmd": "ALARM-ON"}
 * {"cmd": "ALARM-OFF"}
 * {"cmd": "SCAN-ON"}
 * {"cmd": "SCAN-OFF"}
 * {"cmd": "WRITE", "data", "<bytes>"}
 */

var net  = require('net');

function TCPSocket(rfid,logger) {
  var self = this;
  PORT = rfid.config.tcpsocket.port || 4444
  HOST = rfid.config.tcpsocket.host || 'localhost'

  self.server = net.createServer(function(socket) { //'connection' listener
    logger.log('info', 'Client connected: ' + socket.remoteAddress + ':' + socket.remotePort); 
    socket.setEncoding("utf8");
   
    socket.on('data', function(data) {
      //console.log(data.toString("UTF8"));
      try {
        var json = JSON.parse(data.toString("UTF8"));
        switch(json.cmd) {
          case 'ALARM-ON':
            logger.log('debug', 'Activating alarms');
            rfid.activateAFI(function(err, result) {
              if(err) {
                logger.log('debug', result);
                socket.write('{"cmd": "ALARM-ON", "status": "FAILED"}\n');
              } else {
                socket.write('{"cmd": "ALARM-ON", "status": "OK"}\n');
              }
            });
            break;
          case 'ALARM-OFF':
            logger.log('debug', 'Deactivating alarms');
            rfid.deactivateAFI(function(err, result) {
              if(err) {
                logger.log('error', err);
                socket.write('{"cmd": "ALARM-OFF", "status": "FAILED"}\n');
              } else {
                logger.log('debug', result);
                socket.write('{"cmd": "ALARM-OFF", "status": "OK"}\n');
              }
            });
            break;
          case 'SCAN-ON':
            logger.log('debug', 'Starting scanning for tags');
            rfid.startScan(function(err) {
              if(err) {
                logger.log('error', err);
                socket.write('{"cmd": "SCAN-ON", "status": "FAILED"}\n');
              } else {
                socket.write('{"cmd": "SCAN-ON", "status": "OK"}\n');
              }          
            });
            break;
          case 'SCAN-OFF':
          logger.log('debug', 'Stopping scanning for tags');
            rfid.stopScan();
            socket.write('{"cmd": "SCAN-OFF", "status": "OK"}\n');
            rfid.tagsInRange = [];
            break;
          case 'WRITE':
            logger.log('debug', 'Writing to tag: '+id+', data: '+data);
            rfid.writeISO15693(id, data, function(err) {
              if(err) {
                logger.log('error', err);
                socket.write('{"cmd": "WRITE", "status": "FAILED"}\n');
              } else {
                socket.write('{"cmd": "WRITE", "status": "OK"}\n');
              }          
            });
            break;
          default:
            logger.log("error", "unknown command sent: "+JSON.stringify(json));
            socket.write('{"cmd": "UNKNOWN", "status": "FAILED"}\n');
        } 
      } catch (e) {
        logger.log("error: "+e);
      }
    });
    socket.on('end', function() {
      logger.log('info', 'client disconnected');
      rfid.socket = undefined;
    });
    socket.write('{"hello":"you"}\n');
    self.server.emit('ready', socket);    // emit ready to allow rfidgeek to grab socket

    socket.on('error', function(err) {
      logger.log('error', +err.message);
    });

  }).listen(PORT, HOST);
}
module.exports = TCPSocket;