import { Err, Ok, Result } from "@/utils/result";
import { Merge, ToActualType, TypeName } from "./types/utils";

type SheetValue = boolean | number | string | Date;
type SheetHeader = string;

type DataTable = readonly (readonly SheetValue[])[];

type ColumnType<Header extends SheetHeader, Name extends TypeName> = {
    readonly name: Header;
    readonly type: Name;
};

type ColumnTypes<
    CTArray extends readonly ColumnType<SheetHeader, TypeName>[],
    _Result extends readonly ColumnType<SheetHeader, TypeName>[] = []
> = CTArray extends [
    infer First extends ColumnType<SheetHeader, TypeName>,
    ...infer Rest extends readonly ColumnType<SheetHeader, TypeName>[]
]
    ? ColumnTypes<Rest, [..._Result, First]>
    : _Result;

type SheetQueryConfig<
    CTArray extends readonly ColumnType<SheetHeader, TypeName>[],
    _Result extends readonly ColumnType<SheetHeader, TypeName>[] = readonly []
> = CTArray extends [
    infer First extends ColumnType<SheetHeader, TypeName>,
    ...infer Rest extends readonly ColumnType<SheetHeader, TypeName>[]
]
    ? ColumnTypes<Rest, [..._Result, First]>
    : {
          readonly id: number;
          readonly columnTypes: _Result;
      };

type SheetQueryConfigs<
    CTsArray extends readonly ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >[],
    _Result extends readonly SheetQueryConfig<
        ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>
    >[] = readonly []
> = CTsArray extends [
    infer First extends ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >,
    ...infer Rest extends readonly ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >[]
]
    ? SheetQueryConfigs<Rest, [..._Result, SheetQueryConfig<First>]>
    : Readonly<_Result>;

type SheetRecord<
    CTs extends ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>,
    Record extends {
        [x: SheetHeader]: ToActualType<TypeName>;
    } = NonNullable<unknown>
> = CTs extends [
    infer CT extends ColumnType<SheetHeader, TypeName>,
    ...infer RestCTs extends ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >
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

type SheetQuery<
    CTs extends ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>
> = {
    /**
     * Read all records from the sheet.
     * @returns An array of all records in the sheet.
     */
    read(): readonly SheetRecord<CTs>[];

    /**
     * Replace all records in the sheet.
     * @param records Records to be set.
     */
    set(records: readonly SheetRecord<CTs>[]): void;

    /**
     * Append records at the bottom of the sheet.
     * @param records Records to be appended.
     */
    append(records: readonly SheetRecord<CTs>[]): void;

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
    CTsArray extends readonly ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >[],
    _Queries = readonly SheetQuery<
        ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>
    >[]
> = CTsArray extends [
    infer First extends ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >,
    ...infer Rest extends readonly ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >[]
]
    ? SheetQueries<Rest, [_Queries, SheetQuery<First>]>
    : _Queries;

// ----

const createQueryConfig = <
    CTArray extends readonly ColumnType<SheetHeader, TypeName>[]
>(
    id: number,
    columnTypeArray: CTArray
): SheetQueryConfig<CTArray> => {
    return {
        id,
        columnTypes: columnTypeArray,
    } as const;
};

const HEADER_REGEX = /^\s*(?:([^<]+)\s+<(string|number|boolean|Date)>)\s*$/;
const validateColumnTypes = (
    sheetValues: DataTable,
    columnTypes: ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>
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
    CTs extends ColumnTypes<readonly ColumnType<SheetHeader, TypeName>[]>,
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

export const useSheetQuery = async <
    CTsArray extends readonly ColumnTypes<
        readonly ColumnType<SheetHeader, TypeName>[]
    >[],
    T
>(
    proc: (query: SheetQueries<CTsArray>) => T,
    configs: SheetQueryConfigs<CTsArray>,
    options?: Partial<{
        timeouts: number;
    }>
): Promise<Awaited<Result<T, Error>>> => {
    const defaultOptions = {
        timeouts: 5000,
    } as const;
    options = options ?? defaultOptions;
    options.timeouts = options.timeouts ?? defaultOptions.timeouts;

    try {
        lock.waitLock(options.timeouts);

        const queries: SheetQueries<CTsArray> = configs.map((config) =>
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

const createColumnType = <Header extends SheetHeader, Name extends TypeName>(
    name: Header,
    type: Name
): ColumnType<Header, Name> => {
    return { name, type } as const;
};

const createColumnTypes = <
    CTArray extends readonly ColumnType<SheetHeader, TypeName>[]
>(
    ...columnTypes: CTArray
): ColumnTypes<CTArray> => {
    return columnTypes as unknown as ColumnTypes<CTArray>; // TODO
};

// example
// -----------------------------

const USER_SHEET_ID = 1000;
const GROUP_SHEET_ID = 2000;

const USER_COLUMN_TYPES = createColumnTypes(
    createColumnType("User ID", "string"),
    createColumnType("Group ID", "string"),
    createColumnType("Name", "string"),
    createColumnType("Age", "number"),
    createColumnType("Is Employed", "boolean")
);

const GROUP_COLUMN_TYPES = createColumnTypes(
    createColumnType("Group ID", "string"),
    createColumnType("Name", "string"),
    createColumnType("Ave. Grades", "number")
);

const userQueryConfig = createQueryConfig(USER_SHEET_ID, USER_COLUMN_TYPES);
const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, GROUP_COLUMN_TYPES);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bundle = createBundle(userQueryConfig, groupQueryConfig);

// eslint-disable-next-line react-hooks/rules-of-hooks
await useSheetQuery(([user, group]) => {
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
}, bundle);

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
