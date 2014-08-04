 /*
 * Simple logger
 */

module.exports = function logger(){
  var debugLevel = 'error';
  return {
    log: function(lev, message) {
      var levels = ['debug', 'error', 'none'];
      if (levels.indexOf(lev) >= levels.indexOf(debugLevel) ) {
        var msg = {};
        msg[lev] = message;
        return JSON.stringify(msg);
      } 
    }
  }
}();