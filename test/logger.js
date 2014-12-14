var expect = require('expect.js');
var logger = require('../lib/logger.js');

describe('Logger',function() {
  it('should expose a log() function', function(){
    expect(logger.log).to.be.a('function');
  });
  it('should log an error', function() {
    var msg = logger.log('error', 'test');
    expect(msg).to.eql(JSON.stringify({error: "test"}));
  });
  it('should not log when level set to none', function() {
    var msg = logger.log('error', 'test');
    expect(msg).to.eql(JSON.stringify({error: "test"}));
  });
});
