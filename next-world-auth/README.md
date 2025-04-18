# next-world-auth

Authentication and payment abstraction for World [Min Apps](https://docs.world.org/mini-apps) with [Next.js](https://nextjs.org/).

Currently supported:
* Logging in with Wallet
* Getting location
* Ability to augment session with arbitrary data

Notes:
* Package is used in production, but API may change without notice
* Session expiration will be implemented in version 0.1.0+
* For security persistent sessions are implemented using http cookies
* The package is published to [npm](https://www.npmjs.com/package/next-world-auth).
