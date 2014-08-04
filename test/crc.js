var expect = require('expect.js');
var crc = require('../lib/crc.js');

describe('CRC',function() {
  it('should calculate crc16CCITT', function() {
    var bytes = '\x00\x01';
    expect(crc.crc16CCITT(bytes)).to.eql(3374);
  });
});
