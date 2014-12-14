var expect = require('expect.js');
var rfid = require('../rfid');

describe('Init',function() {
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
