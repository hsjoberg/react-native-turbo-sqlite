# Detox Android Tests Disabled

Android E2E tests with Detox are temporarily disabled due to a compatibility issue between Detox and React Native 0.76's new architecture (bridgeless mode).

## Issue

Detox 20.44.0 has synchronization problems with RN 0.76's bridgeless mode on Android. The app times out during `device.launchApp()` while waiting for the "ready" message from the instrumentation process.

## Root Cause

- The app uses TurboModules which require the new architecture to be enabled
- Disabling the new architecture causes the TurboModule to fail to load
- With new architecture enabled, Detox cannot detect when the app becomes idle/ready

## References

- GitHub Issue: https://github.com/wix/Detox/issues/4803
- Related: https://github.com/wix/Detox/issues/4506

## Workaround

Use iOS for E2E testing until Detox resolves the Android compatibility issue:

```bash
yarn test:e2e:ios:build
yarn test:e2e:ios
```

## Re-enabling

Once the issue is resolved:

1. Uncomment the Detox dependency in `android/app/build.gradle`
2. Uncomment the Maven repository configuration
3. Recreate the `android/app/src/androidTest` directory with test files
4. Run `yarn test:e2e:android:build && yarn test:e2e:android`
