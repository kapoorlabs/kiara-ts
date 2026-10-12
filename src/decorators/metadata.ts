import { DecoratorError } from "../errors.js";

type SymbolConstructorWithMetadata = SymbolConstructor & { metadata?: symbol };

const symbolConstructor = Symbol as SymbolConstructorWithMetadata;

export function initializeDecoratorMetadata(): void {
  if (symbolConstructor.metadata !== undefined) {
    return;
  }

  Object.defineProperty(symbolConstructor, "metadata", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Symbol("Symbol.metadata"),
  });
}

export function assertDecoratorMetadataAvailable(): void {
  if (symbolConstructor.metadata === undefined) {
    throw new DecoratorError(
      "Decorator metadata is unavailable. Call initializeDecoratorMetadata() before evaluating decorated classes.",
      "DECORATOR_METADATA_UNAVAILABLE",
    );
  }
}
