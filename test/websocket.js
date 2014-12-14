var expect = require('expect.js');
var rfid = require('../rfid');
var WebSocket = require('ws');

describe('WebSocket', function() {

  beforeEach(function(done) {
    if(!rfid.config.websocket) {
      rfid.init({tcpsocket: false, websocket: {port: 4445, host: 'localhost'} });
    }
    ws = new WebSocket('ws://localhost:4445');
    ws.on('open', function(){
      ws.once('message', function(data) {
        done();
      });
    });
  });
  afterEach(function(done) {
    ws.terminate();
    done();
  });

  it('should respond negative to unknown command', function(done) {
    ws.send('{"cmd": "FOO"}\n', function() {
      ws.once('message', function(data) {
        expect(data).to.be('{"cmd": "UNKNOWN", "status": "FAILED"}\n');
        done();
      });
    });
  });

  it('should respond to command SCAN-ON', function(done) {
    ws.send('{"cmd": "SCAN-ON"}\n', function() {
      ws.once('message', function(data) {
        expect(data).to.be('{"cmd": "SCAN-ON", "status": "OK"}\n');
        done();
      });
    });
  });

  it('should respond to command ALARM-ON', function(done) {
    ws.send('{"cmd": "ALARM-ON"}\n', function() {
      ws.once('message', function(data) {
        expect(data).to.be('{"cmd": "ALARM-ON", "status": "OK"}\n');
        done();
      });
    });
  });
  
  it('should respond to command SCAN-OFF', function(done) {
    ws.send('{"cmd": "SCAN-OFF"}\n', function() {
      ws.once('message', function(data) {
        expect(data).to.be('{"cmd": "SCAN-OFF", "status": "OK"}\n');
        done();
      });
    });
  });
});