var assert = require('assert');
var expect = require('expect.js');
var sinon = require('sinon');
var com = require('../rfid');
var tcp = require('../tcpclient');

describe('init',function() {
  it('should expose a base function', function() {
		expect(com).to.be.a('function');
	});
  it('should expose a init() function', function() {
    var rfid = new com();
    expect(rfid.init).to.be.a('function');
  });
  it('should expose a startscan() function', function() {
		var rfid = new com();
    expect(rfid.startscan).to.be.a('function');
	});
  it('should expose a stopscan() function', function() {
		var rfid = new com();
    expect(rfid.stopscan).to.be.a('function');
	});
});

describe('Rfidgeek', function() {
  it('should create a Rfidgeek object with default values', function() {
    var rfid = new com();
    expect(rfid.websocket).to.be(undefined);
    expect(rfid.portname).to.be('/dev/ttyUSB0');
  });
  
  it('should allow options', function() {
    var rfid = new com({websocket:true, portname: '/dev/ttyUSB1'});
    expect(rfid.websocket).to.be(true);
    expect(rfid.portname).to.be('/dev/ttyUSB1');
  });
});

describe('Logger', function() {
  it('should instantiate a logger, but with no logging as default', function() {
    var rfid = new com();
    expect(logger.debugLevel).to.be('none');
  });
});

describe('tagtypes', function() {
  it('should accept tagtype parameter', function() {
    var rfid = new com({tagtype: '14443A'});
    expect(rfid.tagtype).to.be('14443A');
  });
  
  it('should accept tagtype parameter', function() {
    var rfid = new com({tagtype: '14443A'});
    expect(rfid.tagtype).to.be('14443A');
  });

  it('iso15693 tag found should trigger readtagdata event', function(done) {
    var spy = sinon.spy();
    var dummytag = ['0C0A0B00'];
    var rfid = new com({tagtype: 'iso15693'});
    setTimeout(function () {
      expect(spy.called);
      done();
    }, 500); //timeout with an error in one second
    rfid.on('readtagdata', spy );
    rfid.emit('tagfound', dummytag);
    
  });

  it('proximity tag should not trigger readtagdata event', function(done) {
    var spy = sinon.spy();
    var dummytag = ['0C0A0B00'];
    var rfid = new com({tagtype: '14443A'});
    setTimeout(function () {
      assert(spy.notCalled, 'Event did not fire in 1000 ms.');
      done();
    }, 500); //timeout with an error in one second
    rfid.on('readtagdata',spy);
    rfid.emit('tagfound', dummytag);
  });

});

describe('TCP Socket', function() {
  it('found tag should add to tags in range', function(done) {
    //var spy = sinon.spy();
    var dummydata = '[1234567890,10]\r\n';
    var rfid = new com({tagtype: 'ISO15693'});
    setTimeout(function () {
      rfid.reader.emit('data', dummydata);
      assert(rfid.tagsInRange.length > 0);
      done();
    }, 1000); //timeout with an error in one second
    rfid.init();
  });

  it('should have a pending test');
});