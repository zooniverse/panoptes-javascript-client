(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.JSONAPIClient=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var DEFAULT_SIGNAL, Emitter, arraysMatch, callHandler,
  slice = [].slice;

DEFAULT_SIGNAL = 'change';

arraysMatch = function(array1, array2) {
  var i, item, matches, ref;
  matches = (function() {
    var j, len, results;
    results = [];
    for (i = j = 0, len = array1.length; j < len; i = ++j) {
      item = array1[i];
      if (array2[i] === item) {
        results.push(i);
      }
    }
    return results;
  })();
  return (array1.length === (ref = array2.length) && ref === matches.length);
};

callHandler = function(handler, payload) {
  var boundArgs, context, ref;
  if (Array.isArray(handler)) {
    ref = handler, context = ref[0], handler = ref[1], boundArgs = 3 <= ref.length ? slice.call(ref, 2) : [];
    if (typeof handler === 'string') {
      handler = context[handler];
    }
  } else {
    boundArgs = [];
  }
  handler.apply(context, boundArgs.concat(payload));
};

module.exports = Emitter = (function() {
  Emitter.prototype._callbacks = null;

  function Emitter() {
    this._callbacks = {};
  }

  Emitter.prototype.listen = function() {
    var arg, base, callback, j, signal;
    arg = 2 <= arguments.length ? slice.call(arguments, 0, j = arguments.length - 1) : (j = 0, []), callback = arguments[j++];
    signal = arg[0];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if ((base = this._callbacks)[signal] == null) {
      base[signal] = [];
    }
    this._callbacks[signal].push(callback);
    return this;
  };

  Emitter.prototype.stopListening = function() {
    var arg, callback, handler, i, index, j, k, ref, signal;
    arg = 2 <= arguments.length ? slice.call(arguments, 0, j = arguments.length - 1) : (j = 0, []), callback = arguments[j++];
    signal = arg[0];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if (this._callbacks[signal] != null) {
      if (callback != null) {
        if (Array.isArray(callback)) {
          index = -1;
          ref = this._callbacks[signal];
          for (i = k = ref.length - 1; k >= 0; i = k += -1) {
            handler = ref[i];
            if (Array.isArray(handler)) {
              if (arraysMatch(callback, handler)) {
                index = i;
                break;
              }
            }
          }
        } else {
          index = this._callbacks[signal].lastIndexOf(callback);
        }
        if (index !== -1) {
          this._callbacks[signal].splice(index, 1);
        }
      } else {
        this._callbacks[signal].splice(0);
      }
    }
    return this;
  };

  Emitter.prototype.emit = function() {
    var callback, j, len, payload, ref, signal;
    signal = arguments[0], payload = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if (signal in this._callbacks) {
      ref = this._callbacks[signal];
      for (j = 0, len = ref.length; j < len; j++) {
        callback = ref[j];
        callHandler(callback, payload);
      }
    }
    return this;
  };

  Emitter.prototype.destroy = function() {
    var callback, j, len, ref, signal;
    this.emit('destroy');
    for (signal in this._callbacks) {
      ref = this._callbacks[signal];
      for (j = 0, len = ref.length; j < len; j++) {
        callback = ref[j];
        this.stopListening(signal, callback);
      }
    }
  };

  return Emitter;

})();



},{}],2:[function(_dereq_,module,exports){
var DEFAULT_TYPE_AND_ACCEPT, Emitter, JSONAPIClient, Model, RESERVED_TOP_LEVEL_KEYS, Resource, Type, makeHTTPRequest, mergeInto,
  slice = [].slice,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

makeHTTPRequest = _dereq_('./make-http-request');

mergeInto = _dereq_('./merge-into');

Emitter = _dereq_('./emitter');

Type = _dereq_('./type');

Model = _dereq_('./model');

Resource = _dereq_('./resource');

DEFAULT_TYPE_AND_ACCEPT = {
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/vnd.api+json'
};

RESERVED_TOP_LEVEL_KEYS = ['meta', 'links', 'linked', 'data'];

JSONAPIClient = (function() {
  var fn, i, len, method, ref;

  JSONAPIClient.prototype.root = '/';

  JSONAPIClient.prototype.headers = null;

  JSONAPIClient.prototype._typesCache = null;

  function JSONAPIClient(root, headers1) {
    this.root = root;
    this.headers = headers1 != null ? headers1 : {};
    this._typesCache = {};
  }

  JSONAPIClient.prototype.request = function(method, url, payload, headers) {
    var allHeaders, fullURL;
    fullURL = this.root + url;
    allHeaders = mergeInto({}, DEFAULT_TYPE_AND_ACCEPT, this.headers, headers);
    return makeHTTPRequest(method, fullURL, payload, allHeaders).then(this.processResponse.bind(this))["catch"](this.handleError.bind(this));
  };

  ref = ['get', 'post', 'put', 'delete'];
  fn = function(method) {
    return JSONAPIClient.prototype[method] = function() {
      return this.request.apply(this, [method].concat(slice.call(arguments)));
    };
  };
  for (i = 0, len = ref.length; i < len; i++) {
    method = ref[i];
    fn(method);
  }

  JSONAPIClient.prototype.processResponse = function(request) {
    var headers, j, k, l, len1, len2, len3, linkedResources, ref1, ref2, ref3, ref4, resourceData, resources, response, results, typeName;
    response = (function() {
      try {
        return JSON.parse(request.responseText);
      } catch (_error) {
        return {};
      }
    })();
    headers = this._getHeadersFor(request);
    if ('links' in response) {
      this._handleLinks(response.links);
    }
    if ('linked' in response) {
      ref1 = response.linked;
      for (typeName in ref1) {
        linkedResources = ref1[typeName];
        ref2 = [].concat(linkedResources);
        for (j = 0, len1 = ref2.length; j < len1; j++) {
          resourceData = ref2[j];
          this.type(typeName).create(resourceData, headers, response.meta);
        }
      }
    }
    results = [];
    if ('data' in response) {
      ref3 = [].concat(response.data);
      for (k = 0, len2 = ref3.length; k < len2; k++) {
        resourceData = ref3[k];
        results.push(this.type(resourceData.type).create(resourceData, headers, response.meta));
      }
    } else {
      for (typeName in response) {
        resources = response[typeName];
        if (indexOf.call(RESERVED_TOP_LEVEL_KEYS, typeName) < 0) {
          ref4 = [].concat(resources);
          for (l = 0, len3 = ref4.length; l < len3; l++) {
            resourceData = ref4[l];
            results.push(this.type(typeName).create(resourceData, headers, response.meta));
          }
        }
      }
    }
    return results;
  };

  JSONAPIClient.prototype._getHeadersFor = function(request) {
    var headers, j, key, len1, pair, ref1, ref2, value;
    headers = {};
    ref1 = request.getAllResponseHeaders().split('\n');
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      pair = ref1[j];
      if (!(pair !== '')) {
        continue;
      }
      ref2 = pair.split(':'), key = ref2[0], value = 2 <= ref2.length ? slice.call(ref2, 1) : [];
      headers[key.trim()] = value.join(':').trim();
    }
    return headers;
  };

  JSONAPIClient.prototype._handleLinks = function(links) {
    var attributeName, href, link, ref1, results1, type, typeAndAttribute, typeName;
    results1 = [];
    for (typeAndAttribute in links) {
      link = links[typeAndAttribute];
      ref1 = typeAndAttribute.split('.'), typeName = ref1[0], attributeName = ref1[1];
      if (typeof link === 'string') {
        href = link;
      } else {
        href = link.href, type = link.type;
      }
      results1.push(this._handleLink(typeName, attributeName, href, type));
    }
    return results1;
  };

  JSONAPIClient.prototype._handleLink = function(typeName, attributeName, hrefTemplate, attributeTypeName) {
    var base, type;
    type = this.type(typeName);
    if ((base = type._links)[attributeName] == null) {
      base[attributeName] = {};
    }
    if (hrefTemplate != null) {
      type._links[attributeName].href = hrefTemplate;
    }
    if (attributeTypeName != null) {
      return type._links[attributeName].type = attributeTypeName;
    }
  };

  JSONAPIClient.prototype.handleError = function() {
    return Promise.reject.apply(Promise, arguments);
  };

  JSONAPIClient.prototype.type = function(name) {
    var base;
    if ((base = this._typesCache)[name] == null) {
      base[name] = new Type(name, this);
    }
    return this._typesCache[name];
  };

  JSONAPIClient.prototype.createType = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use JSONAPIClient::type, not ::createType'].concat(slice.call(arguments)));
    }
    return this.type.apply(this, arguments);
  };

  return JSONAPIClient;

})();

module.exports = JSONAPIClient;

module.exports.makeHTTPRequest = makeHTTPRequest;

module.exports.Emitter = Emitter;

module.exports.Type = Type;

module.exports.Model = Model;

module.exports.Resource = Resource;

Object.defineProperty(module.exports, 'util', {
  get: function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn('makeHTTPRequest is available directly from the JSONAPIClient object, no need for `util`');
    }
    return {
      makeHTTPRequest: makeHTTPRequest
    };
  }
});



},{"./emitter":1,"./make-http-request":3,"./merge-into":4,"./model":5,"./resource":6,"./type":7}],3:[function(_dereq_,module,exports){
var CACHE_FOR, cachedGets;

CACHE_FOR = 1000;

cachedGets = {};

module.exports = function(method, url, data, headers, modify) {
  var key, promise, value;
  method = method.toUpperCase();
  if (method === 'GET') {
    if ((data != null) && Object.keys(data).length !== 0) {
      url += url.indexOf('?') === -1 ? '?' : '&';
      url += ((function() {
        var results;
        results = [];
        for (key in data) {
          value = data[key];
          results.push([key, value].join('='));
        }
        return results;
      })()).join('&');
      data = null;
    }
    promise = cachedGets[url];
  }
  if (promise == null) {
    promise = new Promise(function(resolve, reject) {
      var header, ref, request;
      request = new XMLHttpRequest;
      request.open(method, encodeURI(url));
      request.withCredentials = true;
      if (headers != null) {
        for (header in headers) {
          value = headers[header];
          if (value != null) {
            request.setRequestHeader(header, value);
          }
        }
      }
      if (modify != null) {
        modify(request);
      }
      request.onreadystatechange = function(e) {
        var ref;
        if (request.readyState === request.DONE) {
          if ((200 <= (ref = request.status) && ref < 300)) {
            if (method === 'GET') {
              setTimeout((function() {
                return delete cachedGets[url];
              }), CACHE_FOR);
            }
            return resolve(request);
          } else {
            if (method === 'GET') {
              setTimeout((function() {
                return delete cachedGets[url];
              }), CACHE_FOR);
            }
            return reject(request);
          }
        }
      };
      if ((data != null) && (headers != null ? (ref = headers['Content-Type']) != null ? ref.indexOf('json') : void 0 : void 0) !== -1) {
        data = JSON.stringify(data);
      }
      return request.send(data);
    });
  }
  if (method === 'GET') {
    cachedGets[url] = promise;
  }
  return promise;
};



},{}],4:[function(_dereq_,module,exports){
var hasProp = {}.hasOwnProperty;

module.exports = function() {
  var argument, i, key, len, ref, value;
  ref = Array.prototype.slice.call(arguments, 1);
  for (i = 0, len = ref.length; i < len; i++) {
    argument = ref[i];
    if (argument != null) {
      for (key in argument) {
        if (!hasProp.call(argument, key)) continue;
        value = argument[key];
        arguments[0][key] = value;
      }
    }
  }
  return arguments[0];
};



},{}],5:[function(_dereq_,module,exports){
var Emitter, Model, isIndex, mergeInto, removeUnderscoredKeys,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Emitter = _dereq_('./emitter');

mergeInto = _dereq_('./merge-into');

isIndex = function(string) {
  var integer;
  integer = Math.abs(parseInt(string, 10));
  return integer.toString(10) === string && !isNaN(integer);
};

removeUnderscoredKeys = function(target) {
  var i, key, len, results, results1, value;
  if (Array.isArray(target)) {
    results1 = [];
    for (i = 0, len = target.length; i < len; i++) {
      value = target[i];
      results1.push(removeUnderscoredKeys(value));
    }
    return results1;
  } else if ((target != null) && typeof target === 'object') {
    results = {};
    for (key in target) {
      value = target[key];
      if (key.charAt(0) !== '_') {
        results[key] = removeUnderscoredKeys(value);
      }
    }
    return results;
  } else {
    return target;
  }
};

module.exports = Model = (function(superClass) {
  extend(Model, superClass);

  Model.prototype._changedKeys = null;

  function Model() {
    var configs;
    configs = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    Model.__super__.constructor.apply(this, arguments);
    this._changedKeys = [];
    mergeInto.apply(null, [this].concat(slice.call(configs)));
    this.emit('create');
  }

  Model.prototype.update = function(changeSet) {
    var base, i, key, lastKey, len, name, path, ref, rootKey, value;
    if (changeSet == null) {
      changeSet = {};
    }
    if (typeof changeSet === 'string') {
      for (i = 0, len = arguments.length; i < len; i++) {
        key = arguments[i];
        if (indexOf.call(this._changedKeys, key) < 0) {
          (ref = this._changedKeys).push.apply(ref, arguments);
        }
      }
    } else {
      for (key in changeSet) {
        if (!hasProp.call(changeSet, key)) continue;
        value = changeSet[key];
        path = key.split('.');
        rootKey = path[0];
        base = this;
        while (path.length !== 1) {
          if (base[name = path[0]] == null) {
            base[name] = isIndex(path[0]) ? [] : {};
          }
          base = base[path.shift()];
        }
        lastKey = path.shift();
        if (value === void 0) {
          if (Array.isArray(base)) {
            base.splice(lastKey, 1);
          } else {
            delete base[lastKey];
          }
        } else {
          base[lastKey] = value;
        }
        if (indexOf.call(this._changedKeys, rootKey) < 0) {
          this._changedKeys.push(rootKey);
        }
      }
    }
    this.emit('change');
    return this;
  };

  Model.prototype.hasUnsavedChanges = function() {
    return this._changedKeys.length !== 0;
  };

  Model.prototype.toJSON = function() {
    return removeUnderscoredKeys(this);
  };

  Model.prototype.destroy = function() {
    this._changedKeys.splice(0);
    return Model.__super__.destroy.apply(this, arguments);
  };

  return Model;

})(Emitter);



},{"./emitter":1,"./merge-into":4}],6:[function(_dereq_,module,exports){
var Model, PLACEHOLDERS_PATTERN, Resource, ResourcePromise,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice,
  modulo = function(a, b) { return (+a % (b = +b) + b) % b; };

Model = _dereq_('./model');

PLACEHOLDERS_PATTERN = /{(.+?)}/g;

Resource = (function(superClass) {
  extend(Resource, superClass);

  Resource.prototype._type = null;

  Resource.prototype._headers = null;

  Resource.prototype._meta = null;

  Resource.prototype._linksCache = null;

  function Resource(_type) {
    this._type = _type;
    if (this._type == null) {
      throw new Error('Don\'t call the Resource constructor directly, use `client.type("things").create({});`');
    }
    this._headers = {};
    this._meta = {};
    this._linksCache = {};
    Resource.__super__.constructor.call(this, null);
    this._type.emit('change');
    this.emit('create');
  }

  Resource.prototype.getMeta = function(key) {
    if (key == null) {
      key = this._type._name;
    }
    return this._meta[key];
  };

  Resource.prototype.update = function() {
    var value;
    value = Resource.__super__.update.apply(this, arguments);
    if (this.id && this._type._resourcesCache[this.id] !== this) {
      this._type._resourcesCache[this.id] = this;
      this._type.emit('change');
    }
    return value;
  };

  Resource.prototype.save = function() {
    var payload, save;
    payload = {};
    payload[this._type._name] = this.toJSON.call(this.getChangesSinceSave());
    save = this.id ? this.refresh(true).then((function(_this) {
      return function() {
        return _this._type._client.put(_this._getURL(), payload, _this._getHeadersForModification());
      };
    })(this)) : this._type._client.post(this._type._getURL(), payload);
    return new ResourcePromise(save.then((function(_this) {
      return function(arg) {
        var result;
        result = arg[0];
        if (result !== _this) {
          _this.update(result);
          _this._changedKeys.splice(0);
          result.destroy();
        }
        _this.emit('save');
        return _this;
      };
    })(this)));
  };

  Resource.prototype.getChangesSinceSave = function() {
    var changes, i, key, len, ref;
    changes = {};
    ref = this._changedKeys;
    for (i = 0, len = ref.length; i < len; i++) {
      key = ref[i];
      changes[key] = this[key];
    }
    return changes;
  };

  Resource.prototype.refresh = function(saveChanges) {
    var changes;
    if (saveChanges) {
      changes = this.getChangesSinceSave();
      return this.refresh().then((function(_this) {
        return function() {
          return _this.update(changes);
        };
      })(this));
    } else if (this.id) {
      return this._type.get(this.id, {});
    } else {
      throw new Error('Can\'t refresh a resource with no ID');
    }
  };

  Resource.prototype.uncache = function() {
    if (this.id) {
      this.emit('uncache');
      return delete this._type._resourcesCache[this.id];
    } else {
      throw new Error('Can\'t uncache a resource with no ID');
    }
  };

  Resource.prototype["delete"] = function() {
    var deletion;
    deletion = this.id ? this.refresh(true).then((function(_this) {
      return function() {
        return _this._type._client["delete"](_this._getURL(), null, _this._getHeadersForModification());
      };
    })(this)) : Promise.resolve();
    return new ResourcePromise(deletion.then((function(_this) {
      return function() {
        _this.emit('delete');
        _this._type.emit('change');
        _this.destroy();
        return null;
      };
    })(this)));
  };

  Resource.prototype.get = function(name, query) {
    var href, id, ids, ref, resourceLink, result, type, typeLink;
    if ((this._linksCache[name] != null) && (query == null)) {
      return this._linksCache[name];
    } else {
      resourceLink = (ref = this.links) != null ? ref[name] : void 0;
      typeLink = this._type._links[name];
      result = (function() {
        var ref1, ref2, ref3, ref4;
        if ((resourceLink != null) || (typeLink != null)) {
          href = (ref1 = resourceLink != null ? resourceLink.href : void 0) != null ? ref1 : typeLink != null ? typeLink.href : void 0;
          type = (ref2 = resourceLink != null ? resourceLink.type : void 0) != null ? ref2 : typeLink != null ? typeLink.type : void 0;
          id = (ref3 = resourceLink != null ? resourceLink.id : void 0) != null ? ref3 : typeLink != null ? typeLink.id : void 0;
          if (id == null) {
            id = typeof resourceLink === 'string' ? resourceLink : void 0;
          }
          ids = (ref4 = resourceLink != null ? resourceLink.ids : void 0) != null ? ref4 : typeLink != null ? typeLink.ids : void 0;
          if (ids == null) {
            ids = Array.isArray(resourceLink) ? resourceLink : void 0;
          }
          if (href != null) {
            return this._type._client.get(this._applyHREF(href), query).then(function(links) {
              if (id != null) {
                return links[0];
              } else {
                return links;
              }
            });
          } else if (type != null) {
            return this._type._client.type(type).get(id != null ? id : ids, query).then(function(links) {
              if (id != null) {
                return links[0];
              } else {
                return links;
              }
            });
          } else if (name in this) {
            return Promise.resolve(this[name]);
          } else {
            throw new Error("No link '" + name + "' defined for " + this._type._name + "#" + this.id);
          }
        }
      }).call(this);
      result.then((function(_this) {
        return function() {
          return _this._linksCache[name] = result;
        };
      })(this));
      return new ResourcePromise(result);
    }
  };

  Resource.prototype._applyHREF = function(href) {
    var context;
    context = {};
    context[this._type._name] = this;
    return href.replace(PLACEHOLDERS_PATTERN, function(_, path) {
      var ref, ref1, segment, segments, value;
      segments = path.split('.');
      value = context;
      while (segments.length !== 0) {
        segment = segments.shift();
        value = (ref = value[segment]) != null ? ref : (ref1 = value.links) != null ? ref1[segment] : void 0;
      }
      if (Array.isArray(value)) {
        value = value.join(',');
      }
      if (typeof value !== 'string') {
        throw new Error("Value for '" + path + "' in '" + href + "' should be a string.");
      }
      return value;
    });
  };

  Resource.prototype.addLink = function(name, value) {
    var data, url;
    url = this._getURL('links', name);
    data = {};
    data[name] = value;
    return this._type._client.post(url, data).then((function(_this) {
      return function() {
        _this.uncacheLink(name);
        return _this.refresh();
      };
    })(this));
  };

  Resource.prototype.removeLink = function(name, value) {
    var url;
    url = this._getURL('links', name, [].concat(value).join(','));
    return this._type._client["delete"](url).then((function(_this) {
      return function() {
        _this.uncacheLink(name);
        return _this.refresh();
      };
    })(this));
  };

  Resource.prototype.uncacheLink = function(name) {
    return delete this._linksCache[name];
  };

  Resource.prototype._getHeadersForModification = function() {
    return {
      'If-Unmodified-Since': this._getHeader('Last-Modified'),
      'If-Match': this._getHeader('ETag')
    };
  };

  Resource.prototype._getHeader = function(header) {
    var name, value;
    header = header.toLowerCase();
    return ((function() {
      var ref, results1;
      ref = this._headers;
      results1 = [];
      for (name in ref) {
        value = ref[name];
        if (name.toLowerCase() === header) {
          results1.push(value);
        }
      }
      return results1;
    }).call(this))[0];
  };

  Resource.prototype._getURL = function() {
    var ref;
    return this.href || (ref = this._type)._getURL.apply(ref, [this.id].concat(slice.call(arguments)));
  };

  Resource.prototype.link = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Resource::get, not ::link'].concat(slice.call(arguments)));
    }
    return this.get.apply(this, arguments);
  };

  Resource.prototype.getRequestMeta = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Resource::getMeta, not ::getRequestMeta'].concat(slice.call(arguments)));
    }
    return this.getMeta.apply(this, arguments);
  };

  return Resource;

})(Model);

ResourcePromise = (function() {
  var method, methodName, ref;

  ResourcePromise.prototype._promise = null;

  function ResourcePromise(_promise) {
    this._promise = _promise;
    if (!(this._promise instanceof Promise)) {
      throw new Error('ResourcePromise requires a real promise instance');
    }
  }

  ResourcePromise.prototype.then = function() {
    var ref;
    return (ref = this._promise).then.apply(ref, arguments);
  };

  ResourcePromise.prototype["catch"] = function() {
    var ref;
    return (ref = this._promise)["catch"].apply(ref, arguments);
  };

  ResourcePromise.prototype.index = function(index) {
    this._promise = this._promise.then(function(value) {
      index = modulo(index, value.length);
      return value[index];
    });
    return this;
  };

  ref = Resource.prototype;
  for (methodName in ref) {
    method = ref[methodName];
    if (typeof method === 'function' && !(methodName in ResourcePromise.prototype)) {
      (function(methodName) {
        return ResourcePromise.prototype[methodName] = function() {
          var args;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          this._promise = this._promise.then((function(_this) {
            return function(promisedValue) {
              var resource, result, results;
              results = (function() {
                var i, len, ref1, results1;
                ref1 = [].concat(promisedValue);
                results1 = [];
                for (i = 0, len = ref1.length; i < len; i++) {
                  resource = ref1[i];
                  result = resource[methodName].apply(resource, args);
                  if (result instanceof this.constructor) {
                    result = result._promise;
                  }
                  results1.push(result);
                }
                return results1;
              }).call(_this);
              if (Array.isArray(promisedValue)) {
                return Promise.all(results);
              } else {
                return results[0];
              }
            };
          })(this));
          return this;
        };
      })(methodName);
    }
  }

  return ResourcePromise;

})();

module.exports = Resource;

module.exports.Promise = ResourcePromise;



},{"./model":5}],7:[function(_dereq_,module,exports){
var Emitter, Resource, Type, mergeInto,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

Emitter = _dereq_('./emitter');

Resource = _dereq_('./resource');

mergeInto = _dereq_('./merge-into');

module.exports = Type = (function(superClass) {
  extend(Type, superClass);

  Type.prototype.Resource = Resource;

  Type.prototype._name = '';

  Type.prototype._client = null;

  Type.prototype._links = null;

  Type.prototype._resourcesCache = null;

  function Type(_name, _client) {
    this._name = _name;
    this._client = _client;
    Type.__super__.constructor.apply(this, arguments);
    this._links = {};
    this._resourcesCache = {};
    if (!(this._name && (this._client != null))) {
      throw new Error('Don\'t call the Type constructor directly, use `client.type("things");`');
    }
  }

  Type.prototype.create = function(data, headers, meta) {
    var ref, ref1, resource;
    if (data == null) {
      data = {};
    }
    if (headers == null) {
      headers = {};
    }
    if (meta == null) {
      meta = {};
    }
    if (data.type && data.type !== this._name) {
      return (ref = this._client.type(data.type)).create.apply(ref, arguments);
    } else {
      resource = (ref1 = this._resourcesCache[data.id]) != null ? ref1 : new this.Resource(this);
      mergeInto(resource._headers, headers);
      mergeInto(resource._meta, meta);
      resource.update(data);
      if (resource === this._resourcesCache[data.id]) {
        resource._changedKeys.splice(0);
      }
      return resource;
    }
  };

  Type.prototype.get = function() {
    return new Resource.Promise(typeof arguments[0] === 'string' ? this._getByID.apply(this, arguments) : Array.isArray(arguments[0]) ? this._getByIDs.apply(this, arguments) : this._getByQuery.apply(this, arguments));
  };

  Type.prototype._getByID = function() {
    var id, otherArgs;
    id = arguments[0], otherArgs = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    return this._getByIDs.apply(this, [[id]].concat(slice.call(otherArgs))).then(function(arg) {
      var resource;
      resource = arg[0];
      return resource;
    });
  };

  Type.prototype._getByIDs = function() {
    var id, ids, otherArgs, requests;
    ids = arguments[0], otherArgs = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    requests = (function() {
      var i, len, ref, results;
      results = [];
      for (i = 0, len = ids.length; i < len; i++) {
        id = ids[i];
        if (id in this._resourcesCache && otherArgs.length === 0) {
          results.push(Promise.resolve(this._resourcesCache[id]));
        } else {
          results.push((ref = this._client).get.apply(ref, [this._getURL(id)].concat(slice.call(otherArgs))).then(function(arg) {
            var resource;
            resource = arg[0];
            return resource;
          }));
        }
      }
      return results;
    }).call(this);
    return Promise.all(requests);
  };

  Type.prototype._getByQuery = function() {
    var otherArgs, query, ref;
    query = arguments[0], otherArgs = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    return (ref = this._client).get.apply(ref, [this._getURL(), query].concat(slice.call(otherArgs)));
  };

  Type.prototype._getURL = function() {
    return ['', this._name].concat(slice.call(arguments)).join('/');
  };

  Type.prototype.createResource = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Type::create, not ::createResource'].concat(slice.call(arguments)));
    }
    return this.create.apply(this, arguments);
  };

  return Type;

})(Emitter);



},{"./emitter":1,"./merge-into":4,"./resource":6}]},{},[2])(2)
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _slicedToArray(arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }

var _jsonApiClient = require('json-api-client');

var _jsonApiClient2 = _interopRequireDefault(_jsonApiClient);

var _utils = require('./utils');

var Model = _jsonApiClient2['default'].Model;
var makeHTTPRequest = _jsonApiClient2['default'].makeHTTPRequest;

exports['default'] = function (panoptesClient) {
  // Use this to override the default API-specific headers.
  var JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // PhantomJS doesn't send any data with DELETE, so fake it here.
  var DELETE_METHOD_OVERRIDE_HEADERS = Object.create(JSON_HEADERS);
  DELETE_METHOD_OVERRIDE_HEADERS['X-HTTP-Method-Override'] = 'DELETE';

  // This will match the CSRF token in a string of HTML.
  // TODO: Get JSON instead.
  var CSRF_TOKEN_PATTERN = (function () {
    var CONTENT_ATTR = 'content=[\'"](.+)[\'"]',
        NAME_ATTR = 'name=[\'"]csrf-token[\'"]';
    return RegExp(NAME_ATTR + '\\s*' + CONTENT_ATTR + '|' + CONTENT_ATTR + '\\s*' + NAME_ATTR);
  })();

  // We don't want to wait until the token is already expired before refreshing it.
  var TOKEN_EXPIRATION_ALLOWANCE = 10 * 1000;

  var host = panoptesClient.host;
  var api = panoptesClient.api;

  var auth = new Model({
    _currentUserPromise: null,
    _bearerToken: '',
    _bearerRefreshTimeout: NaN,

    _getAuthToken: function _getAuthToken() {
      console.log('Getting auth token');

      var authTokenRequest = makeHTTPRequest('GET', host + '/?now=' + Date.now(), null, { 'Accept': 'text/html' }).then(function (request) {
        var _request$responseText$match = request.responseText.match(CSRF_TOKEN_PATTERN);

        var _request$responseText$match2 = _slicedToArray(_request$responseText$match, 3);

        var _ = _request$responseText$match2[0];
        var authTokenMatch1 = _request$responseText$match2[1];
        var authTokenMatch2 = _request$responseText$match2[2];
        var authToken = authTokenMatch1 ? authTokenMatch1 : authTokenMatch2;

        console.info('Got auth token ' + authToken.slice(0, 6) + '...');
        return authToken;
      })['catch'](function (request) {
        console.error('Failed to get auth token');
        return api.handleError(request);
      });

      return authTokenRequest;
    },

    _getBearerToken: function _getBearerToken() {
      var _this = this;

      console.log('Getting bearer token');

      if (this._bearerToken) {
        console.info('Already had a bearer token', this._bearerToken);
        return Promise.resolve(this._bearerToken);
      } else {
        var bearerTokenRequest = undefined,
            data = {
          grant_type: 'password',
          client_id: panoptesClient.appID
        };

        return bearerTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function (request) {
          var token = _this._handleNewBearerToken(request);
          console.info('Got bearer token ' + token.slice(0, 6) + '...');
          return token;
        })['catch'](function (request) {
          // You're probably not signed in.
          console.error('Failed to get bearer token');
          return api.handleError(request);
        });
      }
    },

    _handleNewBearerToken: function _handleNewBearerToken(request) {
      var response = JSON.parse(request.responseText);

      this._bearerToken = response.access_token;
      panoptesClient.headers['Authorization'] = 'Bearer ' + this._bearerToken;

      var refresh = this._refreshBearerToken.bind(this, response.refresh_token);
      var timeToRefresh = response.expires_in * 1000 - TOKEN_EXPIRATION_ALLOWANCE;
      this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);

      return this._bearerToken;
    },

    _refreshBearerToken: function _refreshBearerToken(refreshToken) {
      var _this2 = this;

      var data = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: panoptesClient.appID
      };

      var refreshTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function (request) {
        var token = _this2._handleNewBearerToken(request);
        console.info('Refreshed bearer token ' + token.slice(0, 6) + '...');
      })['catch'](function (request) {
        console.error('Failed to refersh bearer token');
        return api.handleError(request);
      });

      return refreshTokenRequest;
    },

    _deleteBearerToken: function _deleteBearerToken() {
      this._bearerToken = '';
      delete panoptesClient.headers['Authorization'];
      clearTimeout(this._bearerRefreshTimeout);
      console.log('Deleted bearer token');
    },

    _getSession: function _getSession() {
      console.log('Getting session');

      return api.get('/me').then(function (response) {
        var user = response[0];
        console.info('Got session', user.display_name, user.id);
        return response[0];
      })['catch'](function (error) {
        console.error('Failed to get session');
        throw error;
      });
    },

    register: function register(opts) {
      var _this3 = this;

      if (!(0, _utils.exists)(opts)) {
        opts = {};
      }

      var display_name = opts.display_name,
          email = opts.email,
          password = opts.password,
          global_email_communication = opts.global_email_communication;

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return _this3.signOut().then(function () {
            return _this3.register({
              display_name: display_name,
              email: email,
              password: password,
              global_email_communication: global_email_communication
            });
          });
        } else {
          console.log('Registering new account', display_name);

          var registrationRequest = _this3._getAuthToken().then(function (token) {
            var data = {
              authenticity_token: token,
              user: opts
            };

            // This weird URL is actually out of the API, but returns a JSON-API response.
            return api.post('/../users', data, JSON_HEADERS).then(function () {
              return _this3._getBearerToken().then(function () {
                return _this3._getSession().then(function (user) {
                  console.info('Registered account', user.display_name, user.id);
                  return user;
                });
              });
            })['catch'](function (error) {
              console.error('Failed to register');
              throw error;
            });
          });

          _this3.update({
            _currentUserPromise: registrationRequest['catch'](function () {
              return null;
            })
          });

          return registrationRequest;
        }
      });
    },

    checkCurrent: function checkCurrent() {
      var _this4 = this;

      if (!(0, _utils.exists)(this._currentUserPromise)) {
        console.log('Checking current user');

        this.update({
          _currentUserPromise: this._getBearerToken().then(function () {
            return _this4._getSession();
          })['catch'](function () {
            // Nobody's signed in. This isn't an error.
            console.info('No current user');
            return null;
          })
        });
      }

      return this._currentUserPromise;
    },

    signIn: function signIn(opts) {
      var _this5 = this;

      if (!(0, _utils.exists)(opts)) {
        opts = {};
      }

      var display_name = opts.display_name,
          password = opts.password;

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return _this5.signOut().then(function () {
            return _this5.signIn(opts);
          });
        } else {
          console.log('Signing in', display_name);

          var signInRequest = _this5._getAuthToken().then(function (token) {
            var data = {
              authenticity_token: token,
              user: opts
            };

            return makeHTTPRequest('POST', host + '/users/sign_in', data, JSON_HEADERS).then(function () {
              return _this5._getBearerToken().then(function () {
                return _this5._getSession().then(function (user) {
                  console.info('Signed in', user.display_name, user.id);
                  return user;
                });
              });
            })['catch'](function (request) {
              console.error('Failed to sign in');
              return api.handleError(request);
            });
          });

          _this5.update({
            _currentUserPromise: signInRequest['catch'](function () {
              return null;
            })
          });

          return signInRequest;
        }
      });
    },

    disableAccount: function disableAccount() {
      var _this6 = this;

      console.log('Disabling account');

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return user['delete']().then(function () {
            _this6._deleteBearerToken();
            _this6.update({ _currentUserPromise: Promise.resolve(null) });
            console.info('Disabled account');
            return null;
          });
        } else {
          throw new Error('Failed to disable account; not signed in');
        }
      });
    },

    signOut: function signOut() {
      var _this7 = this;

      console.log('Signing out');

      return this.checkCurrent().then(function (user) {
        return _this7._getAuthToken().then(function (token) {
          var data = {
            authenticity_token: token
          };

          return makeHTTPRequest('POST', host + '/users/sign_out', data, DELETE_METHOD_OVERRIDE_HEADERS).then(function () {
            _this7._deleteBearerToken();
            _this7.update({ _currentUserPromise: Promise.resolve(null) });
            console.info('Signed out');
            return null;
          })['catch'](function (request) {
            console.error('Failed to sign out');
            return api.handleError(request);
          });
        });
      });
    }
  });

  return auth;
};

;
module.exports = exports['default'];

},{"./utils":4,"json-api-client":1}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _jsonApiClient = require('json-api-client');

var _jsonApiClient2 = _interopRequireDefault(_jsonApiClient);

var _utils = require('./utils');

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

var DEFAULT_OPTS = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes.zooniverse.org',
  root: '/api',
  appID: null
};

var handleError = function handleError(request) {
  var response = undefined,
      errorMessage = null;

  if ('message' in request) {
    throw request;
  } else if ('responseText' in request) {
    try {
      response = JSON.parse(request.responseText);
    } catch (error) {}

    if ((0, _utils.exists)(response) && (0, _utils.exists)(response.error)) {
      errorMessage = response.error;

      if ((0, _utils.exists)(response.error_description)) {
        errorMessage = errorMessage + ' ' + response.error_description;
      }
    } else if ((0, _utils.exists)(response) && (0, _utils.exists)(response.errors) && (0, _utils.exists)(response.errors[0].message)) {
      errorMessage = [];

      response.errors.forEach(function (error) {
        var message = error.message;

        if (typeof message == 'string') {
          errorMessage.push(message);
        } else {
          var messageParts = [];
          for (var key in message) {
            var part = message[key];
            messageParts.push(key + ' ' + part);
          }
          errorMessage.push(messageParts.join('\n'));
        }
      });

      errorMessage = errorMessage.join('\n');
    }

    if ((0, _utils.exists)(request.responseText) && request.responseText.indexOf('<!DOCTYPE') != -1) {
      if (errorMessage == null) {
        errorMessage = request.responseText.trim() || request.status + ' ' + request.statusText;
      }
    }

    throw new Error(errorMessage);
  }
};

var PanoptesClient = function PanoptesClient(opts) {
  _classCallCheck(this, PanoptesClient);

  if (typeof opts === 'undefined') {
    opts = DEFAULT_OPTS;
  }

  for (var key in DEFAULT_OPTS) {
    if ((0, _utils.exists)(opts[key])) {
      this[key] = opts[key];
    } else {
      this[key] = DEFAULT_OPTS[key];
    }
  }

  if (!(0, _utils.exists)(this.appID)) {
    throw Error('Must provide an app ID');
  }

  this.api = new _jsonApiClient2['default'](this.host + this.root, this.headers);
  this.api.handleError = handleError;
  this.api.auth = (0, _auth2['default'])(this);
};

exports['default'] = PanoptesClient;
module.exports = exports['default'];

},{"./auth":2,"./utils":4,"json-api-client":1}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
function exists(variable) {
  return typeof variable !== 'undefined' && variable !== null;
}

exports.exists = exists;

// if (!exists(window) && !exists(window.console)) {
//   let proxiedConsole = {},
//       methodsForLogging = ['log', 'info', 'error'];
//   methodsForLogging.forEach(function(method) {   
//     proxiedConsole[method] = Function.prototype
//   });
// }

// export { proxiedConsole as console };

// export console
//   exists: exists,
//   console: (exists(console) ? console : proxiedConsole)
// };

},{}]},{},[3]);
