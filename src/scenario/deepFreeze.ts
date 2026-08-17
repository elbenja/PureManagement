export const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}
