# ResourceCache
Node.js library that caches resources from a string or URL in local files.

## Installation

``` bash
$ npm install resourcecache
```

## Usage
First, load the `ResourceCache` class from the `resourcecache` module and create an instance.

``` js
ResourceCache = require('resourcecache');
cache = new ResourceCache();
```

Then, you can cache a piece of text in a file like this:

``` js
cache.cacheFromString('text', function (error, fileName) {
  console.log('The text has been cached inside', fileName);
  console.log('This file contains:', require('fs').readFileSync(fileName, 'utf-8'));
});
```

Or you can cache an online resource:

``` js
cache.cacheFromUrl('http://perdu.com/', function (error, fileName) {
  console.log('The resource has been cached inside', fileName);
  console.log('This file contains:', require('fs').readFileSync(fileName, 'utf-8'));
});
```
    
Release the file when you don't need it anymore:

``` js
cache.release(fileName);
```

When the process exits, all remaining files will be released.

## Status
This library is in alpha stage and doesn't do much caching yet.  
However, the described interface has been implemented and is fully functional.

An example use can be seen in the [EyeServer](https://github.com/RubenVerborgh/EyeServer/blob/master/lib/eye.js) project.
