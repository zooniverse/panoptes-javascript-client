## Panoptes Client

A Javascript client for accessing the [Panoptes API](https://github.com/zooniverse/Panoptes).

In early stages of development, use with caution.

### Installation

```
npm install panoptes-client
{auth, apiClient, talkClient} = require('panoptes-client');
```

### Usage

#### auth

TODOC auth functions:

- `register`

- `signIn`

- `signOut`

- etc.

#### Resource access

The Panoptes API is built on the very generically named [JSON API Spec](http://jsonapi.org/). This client leans heavily on [this library](https://github.com/zooniverse/json-api-client) to make it easy to access different resources that the API offers.

### Conventions

This project adheres to [Semantic Versioning](http://semver.org/), and follows the changelog format set out at [Keep a CHANGELOG](http://keepachangelog.com/).

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
