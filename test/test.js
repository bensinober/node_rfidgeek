var expect = require('expect.js');
var rfid = require('../rfid');
var net = require('net');
var WebSocket = require('ws');

describe('init',function() {
  it('should expose a init() function', function() {
    expect(rfid.init).to.be.a('function');
  });
  it('should expose a startScan() function', function() {
    expect(rfid.startScan).to.be.a('function');
	});
  it('should expose a stopScan() function', function() {
    expect(rfid.stopScan).to.be.a('function');
	});
});

describe('rfidGeek config', function() {
  it('should create a rfidGeek object with default values', function() {
    rfid.init();
    expect(rfid.config.websocket).to.be(false);
    expect(rfid.config.portname).to.be('/dev/ttyUSB0');
  });
  
  it('should accept tagtype parameter', function() {
    rfid.init({tagtype: 'ISO14443A'});
    expect(rfid.config.tagtype).to.be('ISO14443A');
  });
});

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
