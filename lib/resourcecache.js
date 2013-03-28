var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    url = require('url');

function ResourceCache() {
  // dummy constructor to enable ResourceCache construction without new
  function F() {}
  F.prototype = ResourceCache.prototype;
  
  // create and return new ResourceCache object
  var resourceCache = new F();
  // add destructor-like behavior
  process.setMaxListeners((process._maxListeners || 10) + 1);
  process.once('exit', function () {
    resourceCache.destroy();
    process.setMaxListeners(process._maxListeners > 10 ? process._maxListeners - 1 : 10);
  });
  return resourceCache;
}

ResourceCache.prototype = {
  constructor: ResourceCache,
  
  getDirectoryName: function (callback) {
    var self = this;
    
    // check if the directory name was already chosen,
    // or if another getDirectoryName result is pending
    switch (typeof(this.dirName)) {
    // dirName is a string: name aready chosen
    case 'string':
      callback(null, this.dirName);
      return;
    // dirName is a callback function: other result pending
    case 'function':
      // chain this callback to the existing callback
      var oldDirName = this.dirName;
      this.dirName = function (err, dirName) {
        oldDirName(err, dirName);
        callback(err, dirName);
      };
      return;
    }
    
    // indicate getDirectoryName is pending by setting the callback
    this.dirName = callback;
    
    // create the directory and notify callbacks
    function createDirectory(prefix, counter) {
      var dirName = prefix + counter + '/';
      fs.mkdir(dirName, 755, function (err) {
        // self.dirname might contain chained callbacks by now
        callback = self.dirName;
        if (!err) {
          self.dirName = dirName;
          callback(null, dirName);
        }
        else {
          if (err.code === 'EEXIST')
            createDirectory(prefix, counter + 1);
          else
            callback(err, null);
        }
      });
    }
    createDirectory('/tmp/node_' + process.pid + '_', 0);
  },
  
  cacheFromString: function (data, callback) {
    var self = this;
    this.getDirectoryName(function (err, dirName) {
      if (err)
        return callback(err, null);
      
      var fileName = dirName + (self.fileId++) + '.tmp';
      self.fileNames.push(fileName);
      fs.writeFile(fileName, data, 'utf8', function (err) {
        if (err)
          callback(err, null);
        else
          callback(null, fileName);
      });
    });
  },
  
  cacheFromUrl: function (resourceUrl, contentType, callback) {
    var self = this;
    // the contentType argument is optional
    if (!callback) {
      callback = contentType;
      contentType = null;
    }
    
    this.getDirectoryName(function (err, dirName) {
      if (err)
        return callback(err, null);
      
      // determine to URL to fetch
      var urlParts = url.parse(resourceUrl),
          isHttps = urlParts.protocol === 'https:',
          protocol = isHttps ? https : http;
      var requestOptions = {
        host: urlParts.hostname,
        port: urlParts.port || (isHttps ? 443 : 80),
        path: (urlParts.pathname || '') + (urlParts.search || ''),
        headers: contentType ? { accept: contentType } : {}
      };
      
      // perform the GET request
      protocol.get(requestOptions, function (response) {
        if (response.statusCode !== 200) {
          return callback('GET request to ' + resourceUrl + ' failed with status ' + response.statusCode, null);
        }
        
        // read the response data
        var buffers = [],     // list of unwritten data segments
            finished = false; // true if all response has been received
        // try to hold the response until the file is ready
        response.pause();
        // when new response data arrives
        response.on('data', function (data) {
          // add to buffers if the file is not ready yet
          if (buffers)
            buffers.push(data);
          // write directly to disk if the file is ready
          else
            fileStream.write(data);
        });
        // when all response data has been received
        response.on('end', function () {
          // mark as finished
          finished = true;
          // if the file is ready, close it and fire callback
          if (!buffers)
            fileStream.end();
        });
        
        // create a new file
        var fileName = dirName + (self.fileId++) + '.tmp';
        var fileStream = fs.createWriteStream(fileName);
        self.fileNames.push(fileName);
        // when it is ready for writing
        fileStream.once('open', function () {
          // set up callbacks for end of stream
          fileStream.once('close', notify);
          fileStream.once('finish', notify);
          function notify() {
            if (callback) {
              callback(null, fileName);
              callback = null;
            }
          }
          // write all previously received buffers
          buffers.forEach(function (buffer) {
            fileStream.write(buffer);
          });
          // write directly to the file from now on
          buffers = null;
          // fire the callback if the response is finished
          if (finished)
            fileStream.end();
          // resume the response if not finished
          else
            response.resume();
        });
      }).on('error', function (err) {
        callback(err, null);
      });
    });
  },
  
  release: function (fileName, callback) {
    delete this.fileNames[fileName];
    fs.unlink(fileName, callback);
  },
  
  destroy: function () {
    if (typeof(this.dirName) === 'string') {
      this.fileNames.forEach(function (fileName) {
        try {
          fs.unlinkSync(fileName);
        }
        catch (e) {}
      });
      
      try {
        fs.rmdirSync(this.dirName);
      }
      catch (e) {}
    }
  },
  
  fileId: 0,
  
  fileNames: []
};

module.exports = ResourceCache;
