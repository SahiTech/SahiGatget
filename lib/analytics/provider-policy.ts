export function isLiveProviderDispatchAllowed(testMode: boolean | undefined) {
  return testMode !== true
}
