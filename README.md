## Panoptes Client

A Javascript client for accessing the [Panoptes API](github.com/zooniverse/Panoptes).

In early stages of development, use with caution.

### Installing

```
npm install panoptes-client
PanoptesClient = require('panoptes-client');
// or
bower install panoptes-client
<script type="text/javascript" src="./path/to/component/dist/index.js" />
```

### Using

The Panoptes API is built on the very generically named [JSON API Spec](http://jsonapi.org/). This client leans heavily on [this library](github.com/brian-c/json-api-client) to make it easy to access different resources that the API offers.

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
