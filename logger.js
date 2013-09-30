 /*
 * Simple logger
 */

var logger = exports;
logger.debugLevel = 'error';
logger.log = function(level, message) {
  var levels = ['debug', 'error', 'none'];
  if (levels.indexOf(level) >= levels.indexOf(logger.debugLevel) ) {
    message = JSON.stringify(String(message));
    console.log(level+': '+message);
  }
}