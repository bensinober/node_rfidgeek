var expect = require('expect.js');
var rfid = require('../rfid');

describe('Stringconversion',function() {

  it('calculates CRC and inject to tag content, array position 19-21', function() {
    var array = [];
    for (var i=1;i<=32;i++) {
      array.push('FF')
    } 
    var tag = rfid._calculateCRC(array);
    expect(tag.length).to.be(32);
    expect(tag.slice(19,21)).to.eql(['f7','68']);
  });

  it('reverses a tag ID', function() {
    var tag = rfid._reverseTag('E0E1E2E3E4');
    expect(tag).to.be('E4E3E2E1E0');
  });

  it('converts hex string to ascii', function() {
    var ascii = rfid._hex2ascii('414243');
    expect(ascii).to.be('ABC');
  });

  it('converts a decimal integer to hex', function() {
    var hex = rfid._dec2hex(1);
    expect(hex).to.be('01');
  });
});
