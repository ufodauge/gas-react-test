import { Err, Ok, Result } from "@/utils/result";
import { ToActualType } from "./types/utils";

type DataType = "string" | "number" | "boolean";

type ColumnHeader = {
    readonly name: string;
    readonly type: DataType;
};

type SheetQueryConfig = {
    readonly id: number;
    readonly headers: readonly ColumnHeader[];
};

type SheetRecord<Header extends readonly ColumnHeader[]> = {
    readonly [x in keyof Header]: ToActualType<Header[x]["type"]>;
};

type SheetQuery<Headers extends ColumnHeader> = {
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

type SheetQueries<CTsArray extends readonly DataTypes[]> = {
    readonly [key in keyof CTsArray]: SheetQuery<CTsArray[key]>;
};

export const useSheetQuery = async <T, CTsArray extends readonly DataTypes[]>(
    proc: (query: SheetQueries<CTsArray>) => T,
    configs: SheetQueryConfigs<CTsArray>
): Promise<Awaited<Result<T, Error>>> => {
    const lock = LockService.getScriptLock();
    const sheets = SpreadsheetApp.getActive().getSheets();

    try {
        lock.waitLock(5000);

        const queries: SheetQueries<CTsArray> = configs.map((config) => {
            const { id, columnTypes } = config;
            const sheet = sheets.find((s) => s.getSheetId() === id);
            if (sheet === undefined) {
                throw new Error(`There's no sheet of id ${id}`);
            }

            const range = sheet.getDataRange();
            const sheetValues = range.getValues();

            const values = sheetValues.slice(1);
            const headers = sheetValues.slice(0, 1)[0];

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const columnIndexes: ColumnIndexes<typeof columnTypes> =
                headers.reduce((acc, header, index) => {
                    if (columnTypes[header] !== undefined) {
                        return { ...acc, [header]: index };
                    }
                    throw new Error(`Unknown column name: "${header}"`);
                }, {});

            let __records: readonly SheetRecord<typeof columnTypes>[] =
                values.map((row) =>
                    Object.values(columnTypes).reduce((acc, header) => {
                        return {
                            ...acc,
                            [header]: row[columnIndexes[header]],
                        };
                    }, {})
                );

            const read = (): ReadonlyArray<SheetRecord<typeof columnTypes>> =>
                __records;
            const set = (
                records: ReadonlyArray<SheetRecord<typeof columnTypes>>
            ) => {
                __records = records;
            };
            const append = (
                records: ReadonlyArray<SheetRecord<typeof columnTypes>>
            ) => {
                __records = [...__records, ...records];
            };
            const deleteIf = (
                condition: (record: SheetRecord<typeof columnTypes>) => boolean
            ) => {
                __records = __records.filter((r) => !condition(r));
            };
            const commit = () => {
                const values = __records.map((record) =>
                    headers.map((header) => record[header])
                );

                sheet
                    .getRange(2, 1, values.length, values[0].length)
                    .setValues(values);
            };

            const query: SheetQuery<typeof columnTypes> = {
                read,
                set,
                append,
                deleteIf,
                commit,
            } as const;

            return query;
        });

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
    [
        {
            id: 1000,
            columns: [
                { name: "User ID", type: "string" } as const,
                { name: "Group ID", type: "string" } as const,
                { name: "Name", type: "string" } as const,
                { name: "Age", type: "number" } as const,
                { name: "Is Employed", type: "boolean" } as const,
            ] as const,
        } as const,
        {
            id: 1000,
            columns: [
                { name: "Group ID", type: "string" } as const,
                { name: "Name", type: "string" } as const,
                { name: "Ave. Grades", type: "number" } as const,
            ] as const,
        } as const,
    ]
);
