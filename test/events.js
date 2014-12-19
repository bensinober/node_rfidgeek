var expect = require('expect.js');
var events = require('events');
var sinon = require('sinon');
var assert = require('assert');
var rfid = require('../rfid');

describe('EventEmitter', function() {
  before(function(done) {
    rfid.init();
    rfid.startScan(function(err) {
      if(err) {console.log(err)};
      done();
    });
    //var eventEmitter = new events.EventEmitter();
  });
  after(function(done) {
    rfid.stopScan();
    done()
  });

  it('should allow subscribing to tagsInRange event', function(done){
    this.timeout(1000);
    rfid.reader.once('tagsInRange',function(data){
      assert(true);
      expect(data).to.be('{"hello":"you"}');
      done();
    });
    rfid.reader.emit('tagsInRange', '{"hello":"you"}');
  });

  it('ISO15693tagsfound should fire tagsInRange event', function(done){
    this.timeout(1000);
    var tags = [{id: "XXX", data: { nitems: 1, itemno: 1, barcode: "ABCDE" } }];
    var json = JSON.stringify(tags)
    rfid.reader.once('tagsInRange',function(res){
      assert(true);
      expect(JSON.parse(res).data.barcode).to.eql(tags[0].data.barcode);
      done();
    });
    rfid.reader.emit('ISO15693tagsfound', tags);
  });
});
