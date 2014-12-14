var expect = require('expect.js');
var rfid = require('../rfid');
var sinon = require('sinon');


describe('Commands',function() {
  beforeEach(function(done) {
    rfid.init({debug: "debug"});
    done();
  });

  it('should issue an initialize command', function() {
    rfid.reader.emit('initialize', "01020304", function(err, result) {
      expect(err).to.be.null;
    });
  });

  it('should issue an initialize command', function() {
    rfid.reader.emit('initialize', "01020304", function(err, result) {
      expect(err).to.be.null;
    });
  });

});
