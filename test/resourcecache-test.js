#!/usr/bin/env node

var ResourceCache = require('../lib/resourcecache');
var vows = require('vows'),
    should = require('should'),
    fs = require('fs'),
    path = require('path'),
    express = require('express');
var dummyServer,
    dummyServerSsl,
    dummyPort = 14207,
    dummyPortSsl = 14208,
    dummyRoot = 'http://localhost:' + dummyPort + '/',
    dummyRootSsl = 'https://localhost:' + dummyPortSsl + '/';

vows.describe('ResourceCache').addBatch({
  'The ResourceCache module': {
    topic: function() { return ResourceCache; },
    
    'should be a function': function (ResourceCache) {
      ResourceCache.should.be.a('function');
    },
    
    'should make ResourceCache objects': function (ResourceCache) {
      ResourceCache().constructor.should.eql(ResourceCache);
      ResourceCache().should.be.an.instanceof(ResourceCache);
    },
    
    'should be a ResourceCache constructor': function (ResourceCache) {
      new ResourceCache().constructor.should.eql(ResourceCache);
      new ResourceCache().should.be.an.instanceof(ResourceCache);
    }
  },
  'A ResourceCache': {
    topic: function () {
      dummyServer = createDummyServer();
      dummyServer.listen(dummyPort);
      dummyServerSsl = createDummyServer({ key:  fs.readFileSync('test/assets/privatekey.pem'),
                                           cert: fs.readFileSync('test/assets/certificate.pem') });
      dummyServerSsl.listen(dummyPortSsl);
      return new ResourceCache()
    },
    
    tearDown: function () {
      // unfortunately, tearDown is run directly after the tests have been started,
      // although some of the requests have not been made yet
      // (only an issue when executing this file directly from node, not with vows)
      setTimeout(function () {
        dummyServer.close();
        dummyServerSsl.close();
      }, 500);
    },
    
    'when asked for its directory name': {
      topic: function(resourceCache) {
        return resourceCache.getDirectoryName(this.callback);
      },
      
      'should return the name of a temporary directory': function(err, dirName) {
        should.not.exist(err);
        dirName.should.match(/^\/tmp\/[\w\d_]+\/$/);
      },
      
      'should have created that temporary directory': function(err, dirName) {
        should.not.exist(err);
        path.existsSync(dirName).should.be.true;
      },
      
      'a second time': {
        topic: function(firstDirName, resourceCache) {
          var thiz = this;
          return resourceCache.getDirectoryName(function(err, secondDirName) {
            thiz.callback(err, firstDirName, secondDirName);
          });
        },
        
        'should return the name of the same temporary directory': function(err, firstDirName, secondDirName) {
          should.not.exist(err);
          secondDirName.should.eql(firstDirName);
        }
      }
    },
    
    'when caching a resource from a string': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromString('contents', this.callback);
      },
      
      'should use a temporary file': function(err, result) {
        should.not.exist(err);
        result.should.match(/^\/tmp\/[\w\d_]+\/\d+\.tmp$/);
      },
      
      'should store the resource contents in this file': function(err, result) {
        should.not.exist(err);
        fs.readFileSync(result, 'utf8').should.eql('contents');
      }
    },
    
    'when releasing a resource from cache': {
      topic: function(resourceCache) {
        var thiz = this;
        return resourceCache.cacheFromString('contents', function(err, name) {
          resourceCache.release(name, function(err) {
            thiz.callback(err, name);
          });
        });
      },
      
      'should remove the temporary file': function(err, name) {
        should.not.exist(err);
        path.existsSync(name).should.be.false;
      }
    },
    
    'when caching an existing resource by URL through HTTP': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromUrl(dummyRoot, this.callback);
      },
      
      'should use a temporary file': function(err, result) {
        should.not.exist(err);
        result.should.match(/^\/tmp\/[\w\d_]+\/\d+\.tmp$/);
      },
      
      'should store the resource contents in this file': function(err, result) {
        should.not.exist(err);
        fs.readFileSync(result, 'utf8').should.eql('contents');
      }
    },
    
    'when caching a non-existing resource by URL through HTTP': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromUrl(dummyRoot + 'notexists', this.callback);
      },
      
      'should result in an error': function(err, result) {
        err.should.eql('GET request to ' + dummyRoot + 'notexists failed with status 404');
        should.not.exist(result);
      }
    },
    
    'when caching an existing resource by URL through HTTPS': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromUrl(dummyRootSsl, this.callback);
      },
      
      'should use a temporary file': function(err, result) {
        should.not.exist(err);
        result.should.match(/^\/tmp\/[\w\d_]+\/\d+\.tmp$/);
      },
      
      'should store the resource contents in this file': function(err, result) {
        should.not.exist(err);
        fs.readFileSync(result, 'utf8').should.eql('contents');
      }
    },
    
    'when caching a non-existing resource by URL through HTTPS': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromUrl(dummyRootSsl + 'notexists', this.callback);
      },
      
      'should result in an error': function(err, result) {
        err.should.eql('GET request to ' + dummyRootSsl + 'notexists failed with status 404');
        should.not.exist(result);
      }
    },
    
    'when caching an existing resource by URL with a content type': {
      topic: function(resourceCache) {
        return resourceCache.cacheFromUrl(dummyRoot, 'text/plain', this.callback);
      },
      
      'should send the Content-Type header': function(err, result) {
        should.not.exist(err);
        fs.readFileSync(result, 'utf8').should.eql('contentstext/plain');
      }
    },
  }
}).export(module);

function createDummyServer() {
  var server = express.createServer.apply(express, arguments);
  server.get(/^\/$/, function (req, res, next) {
    var contentType = req.headers.accept || '';
    res.send('contents' + contentType, 200);
  });
  return server;
}
