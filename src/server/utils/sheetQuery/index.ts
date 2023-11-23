type Brand<T, K> = T & { __brand: K };
type SheetScheme = { [key: string]: string | number | boolean };
type SheetQueryConfig<Id extends number, Scheme extends SheetScheme> = Brand<
  Id,
  Scheme
>;

export const createQueryConfig = <Scheme extends SheetScheme>(
  id: number
): SheetQueryConfig<typeof id, Scheme> => {
  return id as SheetQueryConfig<typeof id, Scheme>;
};

// interface SheetQuery<Id extends number, Scheme extends SheetScheme> {
    // read  : () => Promise<SheetQueryConfig<Id, Scheme>>;
    // append: () => Promise<void>;
// }

const createSheetQuery = <Id extends number, Scheme extends SheetScheme>(
  config: SheetQueryConfig<Id, Scheme>
): SheetQuery<Id, Scheme> => {
    const read = async (...header: string[]) => {

    }
};

export const useSheetQuery = async <
  Id extends number,
  Scheme extends SheetScheme
>(
  config: SheetQueryConfig<Id, Scheme>,
  proc: (query: SheetQuery<Id, Scheme>) => Promise<void>
) => await proc(createSheetQuery(config));

// const config = createQueryConfig<{
//   ["UUID"]: string;
//   ["User Name"]: string;
//   ["Age"]: number;
// }>(12345678);

/**
 * ```ts
 * import { createQueryConfig, userSheetQuery } from "spread-sheet-query"
 *
 * const USER_SHEET_CONFIG = createQueryConfig<{
 *   ["UUID"]: string,
 *   ["User Name"]: string,
 *   ["Age"]: number
 * }>(12345678);
 *
 * // this automatically lock spreadsheet.
 * const result = await useSheetQuery(USER_SHEET_CONFIG, async (query) => {
 *   const data: { ["UUID"]: string, ["Age"]: number }[]
 *     = await query.read("UUID", "Age");
 *   const dataAll = await query.read();
 *   await query.append([
 *     { ["UUID"]: "abcdefgh", ["User Name"]: "foo bar", ["Age"]: 24 },
 *   ]);
 * });
 * ```
 */
const SpreadSheetQuery = {};

export default SpreadSheetQuery;
