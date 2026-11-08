/**
 * Stops emitDecoratorMetadata from storing the class itself.
 * A direct class type in a circular ESM import throws
 * "Cannot access X before initialization" while the module is still loading.
 */
export type WrapperType<T> = T;
