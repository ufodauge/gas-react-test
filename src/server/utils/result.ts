import { Result } from "@/utils/result";

type ApiData =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: number]: ApiData }
  | { [key: string]: ApiData }
  | ApiData[]
  | HTMLFormElement;

type ApiResultOk<T extends ApiData> = {
  ok: true;
  data: T;
};

type ApiResultErr = {
  ok: false;
  name: string;
  message: string;
};

type ApiResult<T extends ApiData> = ApiResultOk<T> | ApiResultErr;

const ok = <T extends ApiData>(v: T): ApiResultOk<T> => {
  return {
    ok: true,
    data: v,
  };
};

const err = <E extends Error>(e: E): ApiResultErr => {
  return {
    ok: false,
    name: e.name,
    message: e.message,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Func = (...args: any[]) => Result<ApiData, Error>;

const resultify =
  <
    Fn extends Func,
    T extends ReturnType<Fn> extends Result<infer T extends ApiData, Error>
      ? T
      : never
  >(
    fn: Fn
  ) =>
  (...p: Parameters<typeof fn>): ApiResult<T> => {
    const result = fn(...p);

    if (result.isOk()) {
      return ok(result.value as T);
    }

    return err(result.error);
  };

export const apiHandler = <Fn extends Func>(fn: Fn) => resultify(fn);
