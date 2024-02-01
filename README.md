## Panoptes Client

A Javascript client for accessing the [Panoptes API](https://github.com/zooniverse/Panoptes).

### Installation

You can install the client from [NPM](https://www.npmjs.com/package/panoptes-client):

```npm install panoptes-client```

and use it with:

ES5

```
apiClient = require('panoptes-client/lib/api-client');
auth = require('panoptes-client/lib/auth');
oauth = require('panoptes-client/lib/oauth');
talkClient = require('panoptes-client/lib/talk-client');
```

ES6

```
import apiClient from 'panoptes-client/lib/api-client'
import auth from 'panoptes-client/lib/auth'
import oauth from 'panoptes-client/lib/oauth'
import talkClient from 'panoptes-client/lib/talk-client'
```

### Documentation

The documentation for the library is available at [https://zooniverse.github.io/panoptes-javascript-client/](https://zooniverse.github.io/panoptes-javascript-client/). If there's anything missing, submit a PR!

#### Resource access

The Panoptes API is built on the very generically named [JSON API Spec](http://jsonapi.org/). This client leans heavily on [this library](https://github.com/zooniverse/json-api-client) to make it easy to access different resources that the API offers.

### Conventions

This project adheres to [Semantic Versioning](http://semver.org/), and follows the changelog format set out at [Keep a CHANGELOG](http://keepachangelog.com/).

### Running the tests

Tests (via [tap](https://github.com/tapjs/node-tap)) exist for the `auth` module, and can be run with `npm run test`.

## Publishing

1. Create a new branch for the new version.
2. Add the new version to the changelog with summary of changes.
3. Update package.json and package-lock.json with the new version number (manually or with `npm --no-git-tag-version version [major|minor|patch]`).
4. Commit and push the changes to GitHub. Create a pull request, have it reviewed, and merge it.
5. Using GitHub's web interface, create a new tag and release with the new version number and summary of changes.
6. Pull the new version of the package locally, confirm it reflects the new version.
7. Run tests with `npm test`, confirm that they pass.
8. Run `npm publish --dry-run` to check that the package is ready to publish, confirm no errors or issues.
9. Run `npm publish` to publish the new version to npm.

### License

Copyright 2015 Zooniverse

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
