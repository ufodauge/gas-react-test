/* eslint-disable @typescript-eslint/no-unused-vars */
import { ToActualType } from "@/types/utils";
import {
    SheetSchemaTemplate,
    SheetQueryConfig,
    createQueryConfig,
    SheetQueryConfigs,
} from "./createQueryConfig";

type SheetSchema<Template extends SheetSchemaTemplate> = {
    [key in keyof Template]: ToActualType<Template[key]>;
};

type SheetQuery<Template extends SheetSchemaTemplate> = {
    select: <Header extends keyof Template>(
        ...headers: Header[] | ["*"]
    ) => SheetSchema<Pick<Template, (typeof headers)[number]>>[];
    // append: (...rows: SheetSchema<Template>[]) => void;
    // delete: (selector: (rows: SheetSchema<Template>) => boolean) => void;
    // update: () => void;
};

type SheetQueryConfigs<Templates extends readonly SheetSchemaTemplate[]> = {
    readonly [key in keyof Templates]: SheetQueryConfig<Templates[key]>;
};

type SheetQueries<Templates extends readonly SheetSchemaTemplate[]> = {
    readonly [key in keyof Templates]: SheetQuery<Templates[key]>;
};

const createSheetQuery = <Templates extends readonly SheetSchemaTemplate[]>(
    ...config: SheetQueryConfigs<Templates>
): SheetQueries<Templates> => {
    const data = SpreadsheetApp.getActive()
        .getSheets()
        .reduce((acc, sheet) => {
            const id = sheet.getSheetId();

            

            // if (config.find((w) => w.id === id)) {
            //     return 
            // }

            throw new Error(`There's no sheet of id ${id}`);
        });

    // const headers = data.slice(0, 1)[0];
    // // eslint-disable-next-line prefer-const
    // let values = data.slice(1);
    // const columnIndices: { [key in keyof Template]: number } = headers.reduce(
    //     (acc, h, i) => {
    //         if (Object.hasOwn(config.template, h)) {
    //             return { ...acc, [h]: i };
    //         }
    //         throw new Error(`Unknown column name: ${h}`);
    //     },
    //     {}
    // );
    // const select = <Headers extends (keyof Template)[]>(
    //     ...args: Headers | ["*"]
    // ): SheetSchema<Pick<Template, (typeof args)[number]>>[] =>
    //     values.map((row) =>
    //         args[0] === "*"
    //             ? headers.reduce((acc, header) => {
    //                   return { ...acc, [header]: row[columnIndices[header]] };
    //               }, {} as SheetSchema<Template>)
    //             : args.reduce((acc, header) => {
    //                   return { ...acc, [header]: row[columnIndices[header]] };
    //               }, {} as SheetSchema<Pick<Template, (typeof args)[number]>>)
    //     );
    // const append = (...rows: SheetSchema<Template>[]) =>
    //     values.push(
    //         rows.map((row) =>
    //             Object.entries(row).reduce((acc, [k, v]) => {
    //                 acc[columnIndices[k]] = v;
    //                 return acc;
    //             }, [] as unknown[])
    //         )
    //     );
    // const del = (selector: (rows: SheetSchema<Template>) => boolean) => {
    //     // values = values.filter(v => selector());
    // };

    throw new Error("TODO");
    // return {
    //     select,
    //     append,
    //     delete: del,
    // } as const;
};

export const _useSheetQuery = async <
    Templates extends readonly SheetSchemaTemplate[]
>(
    proc: (query: SheetQueries<Templates>) => void,
    ...configs: SheetQueryConfigs<Templates>
) => {
    // Lock
    const queries = createSheetQuery<{
        readonly [key in keyof Templates]: Templates[key];
    }>(...configs);

    proc(queries);
    // Unlock
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
    ["IsEmployed"]: "boolean",
});

const groupQueryConfig = createQueryConfig(GROUP_SHEET_ID, {
    ["Group ID"]: "string",
    ["Name"]: "string",
    ["Ave. Grades"]: "number",
});

const _result = await _useSheetQuery(
    ({ [USER_SHEET_ID]: user, [GROUP_SHEET_ID]: group }) => {
        // const data = query.select("UUID", "Age");
        // data.forEach((v) => {
        //     // `v["User Name"]` cannot be accessible.
        //     console.log(`id: ${v.UUID}, age: ${v.Age}`);
        // });
        // query.append({
        //     ["UUID"]: "abcdefgh",
        //     ["User Name"]: "foo bar",
        //     ["Age"]: 24,
        // });
    },
    [userQueryConfig, groupQueryConfig]
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
 *     = await query.select("UUID", "Age");
 *   const dataAll = await query.select();
 *   await query.append([
 *     { ["UUID"]: "abcdefgh", ["User Name"]: "foo bar", ["Age"]: 24 },
 *   ]);
 * });
 * ```
 */
const SpreadSheetQuery = {};

export default SpreadSheetQuery;
