var expect = require('expect.js');
var rfid = require('../rfid');
var net = require('net');

describe('TCP Socket', function() {
  beforeEach(function() {
    if(!rfid.config.tcpsocket) {
      rfid.init({websocket: false, tcpsocket: {port: 4446, host: 'localhost'} });
      client = net.connect({ port: 4446, host: 'localhost' });
    }
  });
  it('should allow TCP client to connect if configured', function(done) {
    expect(rfid.config.tcpsocket).not.to.be.empty();
    client.once('data', function(data) {
      expect(String(data)).to.be('{"hello":"you"}\n');
      done();
    }); 
  });

  it('should respond negative to unknown command', function(done) {
    client.write('{"cmd": "FOO"}\n', function() {
      client.once('data', function(data) {
        expect(String(data)).to.be('{"cmd": "UNKNOWN", "status": "FAILED"}\n');
        done();
      });
    });
  });

  it('should respond to command SCAN-ON', function(done) {
    client.write('{"cmd": "SCAN-ON"}\n', function() {
      client.once('data', function(data) {
        expect(String(data)).to.be('{"cmd": "SCAN-ON", "status": "OK"}\n');
        done();
      });
    });
  });

  it('should respond to command ALARM-ON', function(done) {
    client.write('{"cmd": "ALARM-ON"}\n', function() {
      client.once('data', function(data) {
        expect(String(data)).to.be('{"cmd": "ALARM-ON", "status": "OK"}\n');
        done();
      });
    });
  });
  
  it('should respond to command SCAN-OFF', function(done) {
    client.write('{"cmd": "SCAN-OFF"}\n', function() {
      client.once('data', function(data) {
        expect(String(data)).to.be('{"cmd": "SCAN-OFF", "status": "OK"}\n');
        done();
      });
    });
  });
});
