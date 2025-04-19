# WorldDev

Starter kit for building World Mini Apps.

[next-world-auth](https://www.npmjs.com/package/next-world-auth) is a package that offers authentication and payment abstraction for World mini apps. In a few lines of code, you have a miniapp with persistent sessions that can be deployed and added to the [World App Store](https://world.org/ecosystem).

The API is currently unstable and may change without notice. 

## Usage

The package has been designed to make it as easy as possible to add authentication to your mini app. You need to:

1. Add the package to your project
2. Wrap your app with the `WorldAuthProvider`
3. Use the `useWorldAuth()` hook
4. If you want to use signInWorldID(), a few environment variables needs to be set for the callback URL and the secret key

```typescript
import { useWorldAuth } from 'next-world-auth/react'

export default function Home() {
  const { isInstalled, isAuthenticated, session, signInWorldID, signInWallet, signOut, getLocation } = useWorldAuth

  return (<>
    ...
  </>)
}
```

## Access the example miniapp

[Code](https://github.com/gip/worlddev/tree/main/next-mini-app)

[Web](https://worlddev.vercel.app/)

[World App](https://worldcoin.org/mini-app?app_id=app_a963cd2077f59caf1146198685eed59a&draft_id=meta_4d75d4955b27044f4ef562e60ad09d17)

<img src="./next-mini-app/public/miniappqr.png" width="400" height="400">
