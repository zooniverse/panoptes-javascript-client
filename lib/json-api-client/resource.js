(function() {
  var Model, Resource, ResourcePromise,
    modulo = function(a, b) { return (+a % (b = +b) + b) % b; };

  Model = require('./model');

  Resource = (function() {
    class Resource extends Model {
      constructor(_type) {
        super(_type);
        this._type = _type;
        if (this._type == null) {
          throw new Error('Don\'t call the Resource constructor directly, use `client.type("things").create({});`');
        }
        this._headers = {};
        this._meta = {};
        this._linksCache = {};
        this._savingKeys = {};
        this._type.emit('change');
        this.emit('create');
      }

      getMeta(key = this._type._name) {
        return this._meta[key];
      }

      update() {
        var value;
        value = super.update(...arguments);
        if (this.id && this._type._resourcesCache[this.id] !== this) {
          this._type._resourcesCache[this.id] = this;
          if (this.href != null) {
            this._type._resourcesCache[this.href] = this;
          }
          this._type.emit('change');
        }
        return value;
      }

      save(query = {}) {
        var base, changes, key, payload;
        payload = {};
        changes = this.toJSON.call(this.getChangesSinceSave());
        payload[this._type._name] = changes;
        this._changedKeys.splice(0);
        for (key in changes) {
          if ((base = this._savingKeys)[key] == null) {
            base[key] = 0;
          }
          this._savingKeys[key] += 1;
        }
        this._write = this._write.catch(() => {
          return null;
        }).then(() => {
          var save;
          save = this.id ? this.refresh(true, query).then(() => {
            return this._type._client.put(this._getURL(), payload, this._getHeadersForModification(), query);
          }) : this._type._client.post(this._type._getURL(), payload, {}, query);
          return new ResourcePromise(save.then(([result]) => {
            for (key in changes) {
              this._savingKeys[key] -= 1;
              if (this._savingKeys[key] === 0) {
                delete this._savingKeys[key];
              }
            }
            if (result !== this) {
              this.update(result);
              result.destroy();
            }
            this.emit('save');
            return this;
          }));
        });
        return this._write;
      }

      getChangesSinceSave() {
        var changes, i, key, len, ref;
        changes = {};
        ref = this._changedKeys;
        for (i = 0, len = ref.length; i < len; i++) {
          key = ref[i];
          changes[key] = this[key];
        }
        return changes;
      }

      refresh(saveChanges, query = {}) {
        var changes;
        if (saveChanges) {
          changes = this.getChangesSinceSave();
          return this.refresh(false, query).then(() => {
            return this.update(changes);
          });
        } else if (this.id) {
          return this._type._client.get(this._getURL(), query);
        } else {
          throw new Error('Can\'t refresh a resource with no ID');
        }
      }

      uncache() {
        if (this.id) {
          this.emit('uncache');
          delete this._type._resourcesCache[this.id];
          return delete this._type._resourcesCache[this.href];
        } else {
          throw new Error('Can\'t uncache a resource with no ID');
        }
      }

      delete(query = {}) {
        this._write = this._write.catch(() => {
          return null;
        }).then(() => {
          var deletion;
          deletion = this.id ? this.refresh(true, query).then(() => {
            return this._type._client.delete(this._getURL(), null, this._getHeadersForModification(), query);
          }) : Promise.resolve();
          return new ResourcePromise(deletion.then(() => {
            this.emit('delete');
            this._type.emit('change');
            this.destroy();
            return null;
          }));
        });
        return this._write;
      }

      get(name, query) {
        var cachedByHREF, fullHREF, href, id, ids, ref, ref1, ref2, ref3, ref4, resourceLink, result, type, typeLink;
        if ((this._linksCache[name] != null) && (query == null)) {
          return this._linksCache[name];
        } else {
          resourceLink = (ref = this.links) != null ? ref[name] : void 0;
          typeLink = this._type._links[name];
          result = (resourceLink != null) || (typeLink != null) ? (href = (ref1 = resourceLink != null ? resourceLink.href : void 0) != null ? ref1 : typeLink != null ? typeLink.href : void 0, type = (ref2 = resourceLink != null ? resourceLink.type : void 0) != null ? ref2 : typeLink != null ? typeLink.type : void 0, id = (ref3 = resourceLink != null ? resourceLink.id : void 0) != null ? ref3 : typeLink != null ? typeLink.id : void 0, id != null ? id : id = typeof resourceLink === 'string' ? resourceLink : void 0, ids = (ref4 = resourceLink != null ? resourceLink.ids : void 0) != null ? ref4 : typeLink != null ? typeLink.ids : void 0, ids != null ? ids : ids = Array.isArray(resourceLink) ? resourceLink : void 0, href != null ? (fullHREF = this._applyHREF(href), cachedByHREF = this._type._client.type(type)._resourcesCache[fullHREF], (cachedByHREF != null) && (query == null) ? Promise.resolve(cachedByHREF) : this._type._client.get(fullHREF, query).then(function(links) {
            if (id != null) {
              return links[0];
            } else {
              return links;
            }
          })) : type != null ? this._type._client.type(type).get(id != null ? id : ids, query).then(function(links) {
            if (id != null) {
              return links[0];
            } else {
              return links;
            }
          }) : void 0) : name in this ? Promise.resolve(this[name]) : this._type._client.get(this._getURL(name));
          result.then(() => {
            if (query == null) {
              return this._linksCache[name] = result;
            }
          });
          return new ResourcePromise(result);
        }
      }

      _applyHREF(href) {
        var context;
        context = {};
        context[this._type._name] = this;
        return href.replace(/{(.+?)}/g, function(_, path) {
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
            throw new Error(`Value for '${path}' in '${href}' should be a string.`);
          }
          return value;
        });
      }

      addLink(name, value) {
        var data, url;
        url = this._getURL('links', name);
        data = {};
        data[name] = value; // TODO: Should this always be an array?
        return this._type._client.post(url, data).then(() => {
          this.uncacheLink(name);
          return this.refresh();
        });
      }

      removeLink(name, value) {
        var url;
        url = this._getURL('links', name, [].concat(value).join(','));
        return this._type._client.delete(url).then(() => {
          this.uncacheLink(name);
          return this.refresh();
        });
      }

      uncacheLink(name) {
        return delete this._linksCache[name];
      }

      _getHeadersForModification() {
        var header, headers, value;
        headers = {
          'If-Unmodified-Since': this._getHeader('Last-Modified'),
          'If-Match': this._getHeader('ETag')
        };
        for (header in headers) {
          value = headers[header];
          if (value == null) {
            delete headers[header];
          }
        }
        return headers;
      }

      _getHeader(header) {
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
      }

      _getURL() {
        if (this.href) {
          return [this.href, ...arguments].join('/');
        } else {
          return this._type._getURL(this.id, ...arguments);
        }
      }

    };

    Resource.prototype._type = null;

    Resource.prototype._headers = null;

    Resource.prototype._meta = null;

    Resource.prototype._linksCache = null;

    Resource.prototype._savingKeys = null;

    Resource.prototype._write = Promise.resolve();

    return Resource;

  }).call(this);

  ResourcePromise = (function() {
    // NOTE: This is totally experimental.
    class ResourcePromise {
      constructor(_promise) {
        this._promise = _promise;
        if (!(this._promise instanceof Promise)) {
          throw new Error('ResourcePromise requires a real promise instance');
        }
      }

      then() {
        return this._promise.then(...arguments);
      }

      catch() {
        return this._promise.catch(...arguments);
      }

      index(index) {
        this._promise = this._promise.then(function(value) {
          index = modulo(index, value.length);
          return value[index];
        });
        return this;
      }

      api(method, ...args) {
        this._promise = this._promise.then((promisedValue) => {
          // convert promisedValue to an array
          const resources = [].concat(promisedValue);
          const results = resources.map(resource => {
            // call resource.method(args) and store the result
            const result = resource[method](...args);
            if (result instanceof this.constructor) {
              return result._promise;
            }
            return result;
          });
          if (Array.isArray(promisedValue)) {
            return Promise.all(results);
          } else {
            return results[0];
          }
        });
        return this;
      }

      delete(...args) {
        return this.api('delete', ...args);
      }

      get(...args) {
        return this.api('get', ...args);
      }

      save(...args) {
        return this.api('save', ...args);
      }

      update(...args) {
        return this.api('update', ...args);
      }

      refresh(...args) {
        return this.api('refresh', ...args);
      }

      uncache(...args) {
        return this.api('uncache', ...args);
      }

      getMeta(...args) {
        return this.api('getMeta', ...args);
      }

      addLink(...args) {
        return this.api('addLink', ...args);
      }

      removeLink(...args) {
        return this.api('removeLink', ...args);
      }

      uncacheLink(...args) {
        return this.api('uncacheLink', ...args);
      }

      getChangesSinceSave(...args) {
        return this.api('getChangesSinceSave', ...args);
      }
    };

    ResourcePromise.prototype._promise = null;

    return ResourcePromise;

  }).call(this);

  module.exports = Resource;

  module.exports.Promise = ResourcePromise;

}).call(this);
