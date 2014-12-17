 /*
 * Serial Port Command Executioner
 */

exports.issueCommand = function issueCommand(reader, cmd, endExpr, callback){
  //console.log("cmd: "+cmd+"\nreg: "+endExpr);
  reader.write(cmd, function(err) {
    if(err){
      callback(err);
    } else {
      var response = '';
      (function loopCmd() {
        if (!endExpr.test(response)) {
          reader.once('data', function(data) {
            response += String(data);
            //setTimeout(function() { loopCmd(); }, 10);
            process.nextTick(function() { loopCmd(); });
          });
        } else {
          callback(null, response);
        } 
      //     reader.removeListener('data', loopCmd);
      //   }
      })();
    }
  });
};