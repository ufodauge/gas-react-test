/* eslint-disable @typescript-eslint/no-explicit-any */
import { Err, Ok } from "@/utils/result";
import { ToActualType, TypeName } from "./types/utils";
import { SheetValueType } from "./types/sheetValue";

type ColumnTypes = { readonly [key: string]: TypeName };

type SheetQueryConfig<CTs extends ColumnTypes> = {
    id: number;
    columnTypes: CTs;
};

const createQueryConfig = <CTs extends ColumnTypes>(
    id: number,
    columnTypes: CTs
) => {
    return { id, columnTypes } as SheetQueryConfig<CTs>;
};

const getSheetDataRangeById = (
    sheets: GoogleAppsScript.Spreadsheet.Sheet[],
    id: number
) => {
    const sheet = sheets.find((s) => s.getSheetId() === id);
    if (sheet === undefined) {
        throw new Error(`There's no sheet of id ${id}`);
    }

    const range = sheet.getDataRange();
    return range;
};

const deriveSheetDataById = (range: GoogleAppsScript.Spreadsheet.Range) => {
    const sheetValues = range.getValues();

    const headers = sheetValues.slice(0, 1)[0];
    const values = sheetValues.slice(1);

    if (headers.some((h) => typeof h !== "string")) {
        throw new Error(
            `Some of the headers is not string (${headers.join(", ")})`
        );
    }

    return { headers, values };
};

type ColumnIndex<CTs extends ColumnTypes, Headers extends readonly string[]> = {
    [key in keyof CTs]: keyof Headers;
};

const getColumnIndices = <
    CTs extends ColumnTypes,
    Headers extends readonly string[]
>(
    headers: Headers,
    columnType: CTs
): ColumnIndex<CTs, Headers> => {
    return headers.reduce((acc, h, i) => {
        if (columnType[h] !== undefined) {
            return { ...acc, [h]: i };
        }
        throw new Error(`Unknown column name: "${h}"`);
    }, {} as ColumnIndex<CTs, Headers>);
};

const createRecordIO = <
    CTs extends ColumnTypes,
    Headers extends readonly string[]
>(
    values: readonly any[][],
    columnIndices: ColumnIndex<CTs, Headers>
): [SheetRecordReader<CTs>, SheetRecordWriter<CTs>] => {
    let raw = values.slice();

    const getter = <Key extends keyof CTs>(
        row: (typeof raw)[number],
        key: Key
    ): ToActualType<CTs[Key]> => {
        return row[columnIndices[key] as keyof typeof row];
    };

    const reader = raw.map(
        (row) =>
            <Key extends keyof CTs>(key: Key) =>
                getter(row, key)
    );

    const writer = (...records: SheetRecord<CTs>[]) => {
        raw = records.map((r) =>
            Object.entries(r).reduce((acc, [k, v]) => {
                acc[columnIndices[k] as number] = v;
            }, [] as any[])
        );
    };

    return [reader, writer];
};

type SheetRecordReader<CTs extends ColumnTypes> = ReadonlyArray<
    <Key extends keyof CTs>(key: Key) => ToActualType<CTs[Key]>
>;

type SheetRecordWriter<CTs extends ColumnTypes> = (
    ...records: SheetRecord<CTs>[]
) => void;

type SheetRecord<CTs extends ColumnTypes> = {
    [key in keyof CTs]: ToActualType<CTs[key]>;
};

type SheetQuery<CTs extends ColumnTypes> = {
    /**
     * Read all records from the sheet.
     * @returns An array of all records in the sheet.
     */
    read(): ReadonlyArray<SheetRecordReader<CTs>>;

    /**
     * Replace all records in the sheet.
     * @param records Records to be set.
     */
    set(...records: SheetRecord<CTs>[]): void;

    /**
     * Append records at the bottom of the sheet.
     * @param records Records to be appended.
     */
    append(...records: SheetRecord<CTs>[]): void;

    /**
     * Delete records based on the specified condition.
     * @param condition A function that returns true if the record should be deleted.
     *                  Records satisfying this condition will be removed from the sheet.
     */
    delete(condition: (record: Readonly<SheetRecord<CTs>>) => boolean): void;

    /**
     * Reflect data onto sheet.
     */
    reflect(): void;
};

type SheetQueryConfigs<Templates extends readonly ColumnTypes[]> = {
    readonly [key in keyof Templates]: SheetQueryConfig<Templates[key]>;
};

const createSheetQuery = <CTs extends ColumnTypes>(
    config: SheetQueryConfig<CTs>,
    sheets: GoogleAppsScript.Spreadsheet.Sheet[]
): SheetQuery<CTs> => {
    const { id, columnTypes } = config;

    const range = getSheetDataRangeById(sheets, id);
    const { headers, values } = deriveSheetDataById(range);

    const columnIndices = getColumnIndices(headers, columnTypes);

    const [reader, writer] = createRecordIO(values, columnIndices);

    return {
        read: () => reader,
        set: (...args: readonly SheetRecord<CTs>[]) => {
            reader = args.slice();
        },
        append: (...args: readonly SheetRecord<CTs>[]) => {
            reader = [...reader, ...args];
        },
        delete: (
            condition: (record: Readonly<SheetRecord<CTs>>) => boolean
        ) => {
            reader = reader.filter((record) => !condition(record));
        },
        reflect: () => {
            range.setValues([...headers, ...raw]);
        },
    };
};

type SheetQueries<Templates extends readonly ColumnTypes[]> = {
    readonly [key in keyof Templates]: SheetQuery<Templates[key]>;
};

const createSheetQueries = <Templates extends readonly ColumnTypes[]>(
    configs: SheetQueryConfigs<Templates>,
    sheets: GoogleAppsScript.Spreadsheet.Sheet[]
): SheetQueries<Templates> => {
    const queries = configs.reduce((qs, c, i) => {
        return { ...qs, [i]: createSheetQuery(c, sheets) };
    }, {} as SheetQueries<Templates>);

    return queries;
};

const lock = LockService.getScriptLock();

export const useSheetQuery = async <Templates extends readonly ColumnTypes[]>(
    proc: (query: SheetQueries<Templates>) => void,
    configs: SheetQueryConfigs<Templates>,
    options?: Partial<{
        timeouts: number;
    }>
) => {
    const defaultOptions = {
        timeouts: 5000,
    } as const;
    options = options ?? defaultOptions;
    options.timeouts = options.timeouts ?? defaultOptions.timeouts;

    try {
        lock.waitLock(options.timeouts);

        const sheets = SpreadsheetApp.getActive().getSheets();
        const queries = createSheetQueries<{
            readonly [key in keyof Templates]: Templates[key];
        }>(configs, sheets);

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

await useSheetQuery(
    ([user, group]) => {
        const userData = user.read();

        userData.forEach((v) => {
            console.log(v.get("Name"), v.get("Age"));
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

        group.delete((r) => r.get("Ave. Grades") > 1);
    },
    [userQueryConfig, groupQueryConfig] as const
);

/**
 * ```ts
 * import { createQueryConfig, userSheetQuery } from "spread-sheet-query"
 *
 * const USER_SHEET_ID = 1000;
 * const GROUP_SHEET_ID = 2000;
 *
 * const userQueryConfig = createQueryConfig(USER_SHEET_ID, {
 *     ["User ID"]: "string",
 *     ["Group ID"]: "string",
 *     ["Name"]: "string",
 *     ["Age"]: "number",
 *     ["Is Employed"]: "boolean",
 * });
 *
 * const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, {
 *     ["Group ID"]: "string",
 *     ["Name"]: "string",
 *     ["Ave. Grades"]: "number",
 * });
 *
 * await useSheetQuery(
 *     ([user, group]) => {
 *         const userData = user.read();
 *
 *         userData.forEach((v) => {
 *             console.log(v["Name"], v["Age"]);
 *         });
 *
 *         group.set({
 *             ["Group ID"]: "0123",
 *             ["Name"]: "aaa",
 *             ["Ave. Grades"]: 1,
 *         });
 *
 *         group.append({
 *             ["Group ID"]: "1234",
 *             ["Name"]: "bbb",
 *             ["Ave. Grades"]: 2,
 *         });
 *
 *         group.delete((r) => r["Ave. Grades"] > 1);
 *     },
 *     [userQueryConfig, groupQueryConfig] as const
 * );
 * ```
 */
const SpreadSheetQuery = {};

export default SpreadSheetQuery;
