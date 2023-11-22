export type Result<T, E extends Error> = Success<T, E> | Failure<E, T>;

interface IResult<T, E extends Error> {
  isOk(): this is Success<T, E>;
  isErr(): this is Failure<E, T>;
  unwrapOr(v: T): T;
}

export class Success<T, E extends Error> implements IResult<T, E> {
  public readonly value: T;

  constructor(value: T) {
    this.value = value;
  }
  isOk(): this is Success<T, E> {
    return true;
  }
  isErr(): this is Failure<E, T> {
    return false;
  }
  unwrapOr() {
    return this.value;
  }
}

export class Failure<E extends Error, T = never> implements IResult<T, E> {
  public readonly error: E;

  constructor(error: E) {
    this.error = error;
  }
  isOk(): this is Success<T, E> {
    return false;
  }
  isErr(): this is Failure<E, T> {
    return true;
  }
  unwrapOr(v: T) {
    return v;
  }
}

export const Ok = <T>(value: T) => {
  return new Success(value);
};

export const Err = <E extends Error>(err: E) => {
  return new Failure(err);
};
