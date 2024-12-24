# jsjiit-server
A nodejs compatible version of jsjiit.

This will not work on the client, for client-side use [jsjiit](https://github.com/codeblech/jsjiit)

#### NOTE: This is only a partial implementation, suited to our purpose. This is not maintained.

## Usage:
Install using npm:
```
npm install jsjiit-server
```

Provides two functions:
```js
import { StudentLogin, GetPersonalInfo } from "jsjiit-server";

const session = await StudentLogin("2342342342", "password-wow")
const info = await GetPersonalInfo(session)
console.log(info)
```

This will print log out the- ya-da-ya-da-ya
