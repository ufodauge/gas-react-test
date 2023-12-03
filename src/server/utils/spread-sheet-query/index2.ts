import { Err, Ok } from "@/utils/result";
import { Merge, ToActualType, TypeName } from "./types/utils";

type SheetValue = boolean | number | string | Date;
type SheetHeader = string;

type DataTable = readonly (readonly SheetValue[])[];

type ColumnType = Readonly<{
    name: SheetHeader;
    type: TypeName;
}>;
type ColumnTypes = ReadonlyArray<ColumnType>;

type SheetQueryConfig<CTs extends ColumnTypes> = Readonly<{
    id: number;
    columnTypes: CTs;
}>;

type SheetQueryConfigs<
    CTsArray extends ReadonlyArray<ColumnTypes>,
    _Configs = readonly SheetQueryConfig<ColumnTypes>[]
> = CTsArray extends [
    infer First extends ColumnTypes,
    ...infer Rest extends ReadonlyArray<ColumnTypes>
]
    ? SheetQueryConfigs<Rest, [_Configs, SheetQueryConfig<First>]>
    : _Configs;

type SheetRecord<
    CTs extends ColumnTypes,
    Record extends {
        [x: SheetHeader]: ToActualType<TypeName>;
    } = NonNullable<unknown>
> = CTs extends [
    infer CT extends ColumnType,
    ...infer RestCTs extends ColumnTypes
]
    ? SheetRecord<
          RestCTs,
          Merge<
              [
                  Record,
                  {
                      [key in CT["name"]]: ToActualType<CT["type"]>;
                  }
              ]
          >
      >
    : Readonly<Record>;

type SheetQuery<CTs extends ColumnTypes> = {
    /**
     * Read all records from the sheet.
     * @returns An array of all records in the sheet.
     */
    read(): ReadonlyArray<SheetRecord<CTs>>;

    /**
     * Replace all records in the sheet.
     * @param records Records to be set.
     */
    set(records: ReadonlyArray<SheetRecord<CTs>>): void;

    /**
     * Append records at the bottom of the sheet.
     * @param records Records to be appended.
     */
    append(records: ReadonlyArray<SheetRecord<CTs>>): void;

    /**
     * Delete records based on the specified condition.
     * @param condition A function that returns true if the record should be deleted.
     * Records satisfying this condition will be removed from the sheet.
     */
    deleteIf(condition: (record: SheetRecord<CTs>) => boolean): void;

    /**
     * Reflect data onto sheet.
     */
    commit(): void;
};

type SheetQueries<
    CTsArray extends ReadonlyArray<ColumnTypes>,
    _Configs = readonly SheetQueryConfig<ColumnTypes>[]
> = CTsArray extends [
    infer First extends ColumnTypes,
    ...infer Rest extends ReadonlyArray<ColumnTypes>
]
    ? SheetQueries<Rest, [_Configs, SheetQuery<First>]>
    : _Configs;

const createQueryConfig = <CTs extends ColumnTypes>(
    id: number,
    columnTypes: CTs
): SheetQueryConfig<CTs> => {
    return { id, columnTypes };
};

const HEADER_REGEX = /^\s*(?:([^<]+)\s+<(string|number|boolean|Date)>)\s*$/;
const validateColumnTypes = (
    sheetValues: DataTable,
    columnTypes: ColumnTypes
) => {
    const headers = sheetValues.slice(0, 1)[0];
    headers.forEach((rawHeader) => {
        if (typeof rawHeader !== "string") {
            throw new Error(`Header does not type of string. (${rawHeader})`);
        }

        const matched = HEADER_REGEX.exec(rawHeader);

        const header = matched?.[1];
        const derivedTypeName = matched?.[2];

        if (header === undefined || derivedTypeName === undefined) {
            throw new Error(`Header does not properly defined. (${rawHeader})`);
        }

        const columnType = columnTypes.find(
            (t) => t.type === derivedTypeName && t.name === header
        );

        if (columnType === undefined) {
            throw new Error(`Unknown headers are defined. (${rawHeader})`);
        }
    });
};

const createSheetQuery = <
    CTs extends ColumnTypes,
    QueryConfig extends SheetQueryConfig<CTs>
>(
    { id, columnTypes }: QueryConfig,
    sheets: GoogleAppsScript.Spreadsheet.Sheet[]
): SheetQuery<CTs> => {
    const sheet = sheets.find((s) => s.getSheetId() === id);
    if (sheet === undefined) {
        throw new Error(`There's no sheet of id ${id}`);
    }

    const range = sheet.getDataRange();

    const sheetValues = range.getValues();

    // Data validations
    validateColumnTypes(sheetValues, columnTypes);

    const values = sheetValues.slice(1);

    let __records: ReadonlyArray<SheetRecord<CTs>> = values.map((row) =>
        columnTypes.reduce((acc, { name }, index) => {
            return { ...acc, [name]: row[index] };
        }, {} as SheetRecord<CTs>)
    );

    const read = (): ReadonlyArray<SheetRecord<CTs>> => __records;
    const set = (records: ReadonlyArray<SheetRecord<CTs>>) => {
        __records = records;
    };
    const append = (records: ReadonlyArray<SheetRecord<CTs>>) => {
        __records = [...__records, ...records];
    };
    const deleteIf = (condition: (record: SheetRecord<CTs>) => boolean) => {
        __records = __records.filter((r) => !condition(r));
    };
    const commit = () => {
        const values = __records.map((record) =>
            columnTypes.map(({ name }) => record[name])
        );

        sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
    };

    return {
        read,
        set,
        append,
        deleteIf,
        commit,
    };
};

const lock = LockService.getScriptLock();
const sheets = SpreadsheetApp.getActive().getSheets();

export const useSheetQuery = async <T, CTsArray extends ColumnTypes>(
    proc: (query: SheetQueries<CTsArray>) => T,
    configs: SheetQueryConfigs<CTsArray>,
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

        const queries: SheetQueries<CTs> = configs.map((config) =>
            createSheetQuery(config, sheets)
        );

        return Ok(proc(queries));
    } catch (error) {
        if (error instanceof Error) {
            console.error(error);
            return Err(error);
        }
        return Err(new Error(`${error}`));
    } finally {
        lock.releaseLock();
    }
};

// example
// -----------------------------

const USER_SHEET_ID = 1000;
const GROUP_SHEET_ID = 2000;

const userQueryConfig = createQueryConfig(USER_SHEET_ID, [
    { name: "User ID", type: "string" },
    { name: "Group ID", type: "string" },
    { name: "Name", type: "string" },
    { name: "Age", type: "number" },
    { name: "Is Employed", type: "boolean" },
] as const);

const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, [
    { name: "Group ID", type: "string" },
    { name: "Name", type: "string" },
    { name: "Ave. Grades", type: "number" },
] as const);

const a = <CTsArray extends ReadonlyArray<ColumnTypes>>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: SheetQueryConfigs<CTsArray>
) => {};

const bundle = [userQueryConfig, groupQueryConfig] as const;

a(bundle);

// eslint-disable-next-line react-hooks/rules-of-hooks
await useSheetQuery(
    ([user, group]) => {
        user.read().forEach((v) => {
            console.log(v["Name"], v["Age"]);
        });

        group.set([
            {
                ["Group ID"]: "0123",
                ["Name"]: "aaa",
                ["Ave. Grades"]: 1,
            },
            {
                ["Group ID"]: "4567",
                ["Name"]: "bbb",
                ["Ave. Grades"]: 6,
            },
        ]);

        group.append([
            {
                ["Group ID"]: "1234",
                ["Name"]: "bbb",
                ["Ave. Grades"]: 2,
            },
        ]);

        group.deleteIf((v) => v["Ave. Grades"] > 1);

        group.commit();

        return user.read().map((v) => [v["Name"], v["Age"]] as const);
    },
    [userQueryConfig, groupQueryConfig] as const
);

/**
 * ```ts
 * import { createQueryConfig, useSheetQuery } from "spread-sheet-query"
 *
 * const USER_SHEET_ID  = 1000;
 * const GROUP_SHEET_ID = 2000;
 *
 * const userQueryConfig = createQueryConfig(USER_SHEET_ID, {
 *     ["User ID"]    : "string",
 *     ["Group ID"]   : "string",
 *     ["Name"]       : "string",
 *     ["Age"]        : "number",
 *     ["Is Employed"]: "boolean",
 * });
 *
 * const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, {
 *     ["Group ID"]   : "string",
 *     ["Name"]       : "string",
 *     ["Ave. Grades"]: "number",
 * });
 *
 * await useSheetQuery(
 *     ([user, group]) => {
 *         user.read().forEach((v) => {
 *             console.log(v["Name"], v["Age"]);
 *         });
 *
 *         group.set([
 *             {
 *                 ["Group ID"]: "0123",
 *                 ["Name"]: "aaa",
 *                 ["Ave. Grades"]: 1,
 *             },
 *             {
 *                 ["Group ID"]: "4567",
 *                 ["Name"]: "bbb",
 *                 ["Ave. Grades"]: 6,
 *             },
 *         ]);
 *
 *         group.append([
 *             {
 *                 ["Group ID"]: "1234",
 *                 ["Name"]: "bbb",
 *                 ["Ave. Grades"]: 2,
 *             },
 *         ]);
 *
 *         group.deleteIf((v) => v["Ave. Grades"] > 1);
 *
 *         group.commit();
 *
 *         return user.read().map((v) => [v["Name"], v["Age"]] as const);
 *     },
 *     [userQueryConfig, groupQueryConfig] as const
 * );
 * ```
 */
const SpreadSheetQuery = {
    createQueryConfig,
    useSheetQuery,
};

export default SpreadSheetQuery;
