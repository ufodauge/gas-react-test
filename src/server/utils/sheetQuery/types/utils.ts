import { TYPE_NAMES } from "@/constants/utils";

export type Primitive =
    | boolean
    | number
    | string
    | undefined
    | symbol
    | object
    | bigint;

export type TypeName = (typeof TYPE_NAMES)[number];

export type ToTypeName<T> = T extends boolean
    ? "boolean"
    : T extends number
    ? "number"
    : T extends string
    ? "string"
    : T extends undefined
    ? "undefined"
    : T extends symbol
    ? "symbol"
    : T extends object
    ? "object"
    : T extends bigint
    ? "bigint"
    : never;

export type ToActualType<T extends TypeName> = T extends "string"
    ? string
    : T extends "number"
    ? number
    : T extends "boolean"
    ? boolean
    : T extends "undefined"
    ? undefined
    : T extends "symbol"
    ? symbol
    : T extends "object"
    ? object
    : T extends "bigint"
    ? bigint
    : never;

export type Entries<T> = (keyof T extends infer U
    ? U extends keyof T
        ? [U, T[U]]
        : never
    : never)[];

export type Merge<
    ObjArr extends object[],
    Acc extends object = NonNullable<unknown>
> = ObjArr extends [infer First, ...infer Rests extends object[]]
    ? First extends object
        ? Merge<
              Rests,
              {
                  [K in keyof First | keyof Acc]: K extends keyof Acc
                      ? Acc[K]
                      : K extends keyof First
                      ? First[K]
                      : never;
              }
          >
        : Acc
    : Acc;

export type ValueOf<T> = T[keyof T];
