import { Err, Ok } from "@/utils/result";
import {
    ColumnTypes,
    SheetQueryConfig,
    createQueryConfig,
} from "./createQueryConfig";
import { ToActualType } from "./types/utils";
import { SheetValueType } from "./types/sheetValue";

type SheetRecord<Types extends ColumnTypes> = {
    [key in keyof Types]: ToActualType<Types[key]>;
};

type SheetQuery<Types extends ColumnTypes> = {
    /**
     * Read all records from the sheet.
     * @returns An array of all records in the sheet.
     */
    read(): ReadonlyArray<SheetRecord<Types>>;

    /**
     * Replace all records in the sheet.
     * @param records Records to be set.
     */
    set(...records: SheetRecord<Types>[]): void;

    /**
     * Append records at the bottom of the sheet.
     * @param records Records to be appended.
     */
    append(...records: SheetRecord<Types>[]): void;

    /**
     * Delete records based on the specified condition.
     * @param condition A function that returns true if the record should be deleted.
     *                  Records satisfying this condition will be removed from the sheet.
     */
    delete(condition: (record: SheetRecord<Types>) => boolean): void;
};

type SheetQueryConfigs<Templates extends readonly ColumnTypes[]> = {
    readonly [key in keyof Templates]: SheetQueryConfig<Templates[key]>;
};

const deriveSheetDataById = (
    sheets: GoogleAppsScript.Spreadsheet.Sheet[],
    id: number
) => {
    const sheet = sheets.find((s) => s.getSheetId() === id);
    if (sheet === undefined) {
        throw new Error(`There's no sheet of id ${id}`);
    }

    const sheetValues = sheet.getDataRange().getValues();

    const headers = sheetValues.slice(0, 1)[0];
    const values = sheetValues.slice(1);

    if (headers.some((h) => typeof h !== "string")) {
        throw new Error(
            `Some of the headers is not string` +
                `(${headers.join(", ")}, sheet id: ${id})`
        );
    }

    return { headers, values };
};

const getHeaderIndices = <Types extends ColumnTypes>(
    headers: string[],
    columnType: Types
) => {
    return headers.reduce<{
        [key in keyof Types]: keyof typeof headers;
    }>(
        (acc, h, i) => {
            if (columnType[h] !== undefined) {
                return { ...acc, [h]: i };
            }
            throw new Error(`Unknown column name: "${h}"`);
        },
        {} as {
            [key in keyof Types]: keyof typeof headers;
        }
    );
};

const createRecords = <Types extends ColumnTypes>(
    values: SheetValueType[][],
    headers: string[],
    headerIndices: { [key in keyof Types]: keyof string[] }
): ReadonlyArray<SheetRecord<Types>> => {
    return values.map((row) => {
        return headers.reduce((acc, h, i) => {
            return { ...acc, [h]: row[headerIndices[i]] };
        }, {} as SheetRecord<Types>);
    });
};

const createSheetQuery = <Types extends ColumnTypes>(
    config: SheetQueryConfig<Types>,
    sheets: GoogleAppsScript.Spreadsheet.Sheet[]
): SheetQuery<Types> => {
    const { id, columnType } = config;

    const { headers, values } = deriveSheetDataById(sheets, id);

    const headerIndices = getHeaderIndices(headers, columnType);

    let records = createRecords(values, headers, headerIndices);

    return {
        read: () => records,
        set: (...args: SheetRecord<Types>[]) => {
            records = args.slice();
        },
        append: (...args: SheetRecord<Types>[]) => {
            records = [...records, ...args];
        },
        delete: (condition: (record: SheetRecord<Types>) => boolean) => {
            records = records.filter((record) => !condition(record));
        },
    };
};

type SheetQueries<Templates extends readonly ColumnTypes[]> = {
    readonly [key in keyof Templates]: SheetQuery<Templates[key]>;
};

const createSheetQueries = <Templates extends readonly ColumnTypes[]>(
    ...configs: SheetQueryConfigs<Templates>
): SheetQueries<Templates> => {
    const sheets = SpreadsheetApp.getActive().getSheets();
    const queries = configs.reduce((qs, c, i) => {
        return { ...qs, [i]: createSheetQuery(c, sheets) };
    }, {} as SheetQueries<Templates>);

    return queries;
};

const lock = LockService.getScriptLock();

export const _useSheetQuery = async <Templates extends readonly ColumnTypes[]>(
    proc: (query: SheetQueries<Templates>) => void,
    configs: SheetQueryConfigs<Templates>,
    options?: Partial<{
        timeouts: number;
    }>
) => {
    const defaultOptions = {
        timeouts: 5000,
    };
    options = options ?? defaultOptions;
    options.timeouts = options.timeouts ?? defaultOptions.timeouts;

    try {
        lock.waitLock(options.timeouts);

        const queries = createSheetQueries<{
            readonly [key in keyof Templates]: Templates[key];
        }>(...configs);

        proc(queries);
    } catch (error) {
        if (error instanceof Error) {
            console.error(error);
            return Err(error);
        }
        return Err(new Error(`${error}`));
    } finally {
        lock.releaseLock();
    }

    return Ok(undefined);
};

// example
// -----------------------------

const USER_SHEET_ID = 1000;
const GROUP_SHEET_ID = 2000;

const userQueryConfig = createQueryConfig(USER_SHEET_ID, {
    ["User ID"]: "string",
    ["Group ID"]: "string",
    ["Name"]: "string",
    ["Age"]: "number",
    ["Is Employed"]: "boolean",
});

const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, {
    ["Group ID"]: "string",
    ["Name"]: "string",
    ["Ave. Grades"]: "number",
});

await _useSheetQuery(
    ([user, group]) => {
        const userData = user.read();

        userData.forEach((v) => {
            console.log(v["Name"], v["Age"]);
        });

        group.set({
            ["Group ID"]: "0123",
            ["Name"]: "aaa",
            ["Ave. Grades"]: 1,
        });

        group.append({
            ["Group ID"]: "1234",
            ["Name"]: "bbb",
            ["Ave. Grades"]: 2,
        });

        group.delete((r) => r["Ave. Grades"] > 1);
    },
    [userQueryConfig, groupQueryConfig] as const
);

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
