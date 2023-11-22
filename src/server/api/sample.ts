// import { Err, Ok, Result } from "../../utils/result";
import { Err, Ok, Result } from "@/utils/result";

export const sample = (param: string): Result<string, Error> => {
  console.log(param);

  if (param === "error") {
    return Err(new Error());
  }

  return Ok("banana");
};

export const sample2 = (
  a: number,
  b: string,
  c: [boolean, number]
): Result<[string, [boolean], number], Error> => {
  console.log(a, b, c);

  return Ok(["banana", [true], 1]);
};
