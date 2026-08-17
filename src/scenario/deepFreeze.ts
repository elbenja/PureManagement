export type DeepReadonly<T> =
  T extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : T extends readonly unknown[]
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T

export const deepFreeze = <const T>(value: T): DeepReadonly<T> => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as DeepReadonly<T>
  }

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value) as DeepReadonly<T>
}
