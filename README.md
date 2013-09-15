# Simple rfidgeek adaptor to Node.js
This adaptor is primarily made for the Univelop 500 RFID reader/writer made by Texas Instruments.
This reader supports the following tags:

* iso15693
* 14443A
* 14443B
* Tag-It

## Using

Uses event emitters for passing iso15693 tag and content, which can be captured by
instantiating an Rfidgeek object thus:

```
var Rfidgeek = require('rfidgeek'); 
var rfid = new Rfidgeek();
```

To initialize reader:

```rfid.init();```

Then to activate the scan loop:

```rfid.start();```

And to deactivate:

```rfid.stop();```


Alternatively, the controller can be passed to an included websocket server, which 
in turn broadcasts to any websocket client connected at port 8080. 

```
var Rfidgeek = require('rfidgeek'); 
var rfid = new Rfidgeek({
  websocket: true
});

```

For now uses the `tagfound` and `rfiddata` events.

For more options check the `rfid.js` file

License is MIT
