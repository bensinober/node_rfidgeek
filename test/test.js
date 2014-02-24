var assert = require('assert');
var expect = require('expect.js');
var sinon = require('sinon');
var com = require('../rfid');
var net = require('net');

var rfid = new com();
var spy = sinon.spy();

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
    expect(logger.debugLevel).to.be('none');
  });
  it('logger level should be configurable', function() {
    var rfid = new com({debug: 'error'});
    expect(logger.debugLevel).to.be('error');
    rfid.init();
  });
  it('should throw error on opening reader to logger', function(done) {
    setTimeout(function () {
      expect(spy.calledWith('something bad'));
      done();
    }, 10); //timeout with an error 
    rfid.init();
    rfid.reader.on('error', spy );
    rfid.reader.emit('error', 'log something bad');
  });
});

describe('tagtypes', function() {
  it('should accept tagtype parameter', function() {
    rfid.tagtype = 'ISO14443A';
    expect(rfid.tagtype).to.be('ISO14443A');
  });
  
  it('iso15693 tag found should trigger readtagdata event', function(done) {
    var spy = sinon.spy();
    var dummydata = '[0123456789ABCDEF,10]\r\n';
    var endOfInventory = '[,40]D\r\n';
    var rfid = new com({tagtype: 'ISO15693'});
    setTimeout(function () {
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', endOfInventory);
      expect(spy.called);
      done();
    }, 10); //timeout with an error 
    rfid.init();
    rfid.on('readtagdata', spy );
    
  });

  it('proximity tag should not trigger readtagdata event', function(done) {
    var spy = sinon.spy();
    var dummydata = '[0123456789ABCDEF,10]\r\n';
    var rfid = new com({tagtype: 'ISO14443A'});
    setTimeout(function () {
      assert(spy.notCalled, 'Event did not fire in 10 ms.');
      done();
    }, 10); //timeout with an error 
    rfid.init();
    rfid.on('readtagdata',spy);
    rfid.emit('tagfound', dummydata);
  });

});

describe('ISO15693', function() {
  before( function(){ 
    dummydata = '[0123456789ABCDEF,10][,40]D\r\n';
    rfid = new com({tagtype: 'ISO15693'});
  });
  it('found tag should add to tags in range', function(done) {
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.emit('checkForTags', dummydata, function(err) {
        if(err) { done(err); }
      });
      console.log(rfid.tagsInRange)
      assert(rfid.tagsInRange.length > 0);
      assert(rfid.tagsInRange[0].id == '0123456789ABCDEF');
      done();
    }, 10); //timeout with an error
    rfid.init();
  });

  it('multiple tags in range should be added', function(done) {
    var dummydata2 = '[0123456789ABCDE0,11]\r\n';
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', dummydata2);
      rfid.reader.emit('data', endOfInventory);
      assert(rfid.tagsInRange.length == 2);
      expect(rfid.tagsInRange[1].id).to.be('0123456789ABCDE0');
      done();
    }, 10); //timeout with an error
    rfid.init();
  });  

  it('conflicting tags should be ignored', function(done) {
    var dummydata2 = '[0123456789ABCDE0,z]\r\n';   // 'z' after comma indicates conflict
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', dummydata2);
      rfid.reader.emit('data', endOfInventory);
      assert(rfid.tagsInRange.length == 1);
      done();
    }, 10); //timeout with an error 
    rfid.init();
  });  

  it('tags should only be registered once', function(done) {
    var dummydata2 = '[1234567890,11]\r\n'; 
    var dummydata3 = '[1234567890,12]D\r\n';   
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', dummydata2);
      rfid.reader.emit('data', dummydata3);
      rfid.reader.emit('data', endOfInventory);
      assert(rfid.tagsInRange.length == 1);
      done();
    }, 10); //timeout with an error 
    rfid.init();
  });  

  it('found tag should not initiate read tag content until inventory is complete', function(done) {
    var spy = sinon.spy();
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      assert(spy.notCalled, 'Event did not fire in 10 ms.');
      done();
    }, 10); //timeout with an error
    rfid.init();
    rfid.reader.on('tagsInRange',spy);
  });

  it('found tag should initiate read tag content when inventory is complete', function(done) {
    var spy = sinon.spy();
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', endOfInventory);
      assert(spy.called, 'Event did fire in 10 ms.');
      done();
    }, 10); //timeout with an error
    rfid.init();
    rfid.reader.on('readtagdata',spy);
  });

  it('all found tags should be read', function(done) {
    var spy = sinon.spy();
    setTimeout(function () {
      rfid.readerState = 'inventory';
      rfid.reader.emit('data', dummydata);
      rfid.reader.emit('data', endOfInventory);
      assert(spy.calledOnce, 'Event did fire in 10 ms.');
      done();
    }, 10); //timeout with an error
    rfid.init();
    rfid.reader.on('readtagdata',spy);
  });
});

describe('ISO15693 data', function() {
  before( function() {
    rfid.tagtype = 'ISO15693';
    tagdata1 = '[001102013130303030303030303030303030303187264E4F30323033303030300000000000]';
    tagdata2 = '[001102023130303030303030303030303030303187264E4F30323033303030300000000000]';
  });

  it('read tag should render data correctly', function(done) {
    setTimeout(function () {
      rfid.tagsInRange.push({id: '0123456789ABCDE0'});
      rfid.readerState = 'readtags';
      rfid.reader.emit('data', tagdata1);
      expect(rfid.tagsInRange[0].data.itemno).to.be(1);
      expect(rfid.tagsInRange[0].data.nitems).to.be(2);
      expect(rfid.tagsInRange[0].data.barcode).to.be('00000000000001');
      done();
    }, 10); //timeout with an error
    rfid.init();
  });

  it('read tag should render two tags correctly', function(done) {
    setTimeout(function () {
      rfid.tagsInRange.push({id: '0123456789ABCDE0'});
      rfid.tagsInRange.push({id: '0123456789ABCDEA'});
      rfid.readerState = 'readtags';
      rfid.reader.emit('data', tagdata1);
      rfid.reader.emit('data', tagdata2);
      expect(rfid.tagsInRange[0].data.itemno).to.be(1);
      expect(rfid.tagsInRange[1].data.itemno).to.be(2);
      done();
    }, 10); //timeout with an error
    rfid.init();
  });

  it('when all tags are read and all required are present, TAGS-OK should be sent', function(done) {
    setTimeout(function () {
      rfid.tagsInRange.push({id: '0123456789ABCDE0'});
      rfid.tagsInRange.push({id: '0123456789ABCDEA'});
      rfid.readerState = 'readtags';
      rfid.reader.emit('data', tagdata1);
      rfid.reader.emit('data', tagdata2);
      expect(spy.called);
      done();
    }, 10); //timeout with an error
    rfid.init();
    rfid.reader.on('tagsfound',spy);
  });  
});

describe('TCP Socket', function() {
  before( function(){ 
    rfid.tagtype = 'ISO15693';
    rfid.websocket = true;
  });

/*  it('should initiate a writable websocket', function(done) {
    rfid.init();
    expect(rfid.socket).to.be(true);
    done();
  });*/

  it('should send tags to connected socket');

});