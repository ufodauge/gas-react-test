import { TypeName } from "./types/utils";

export type ColumnTypes = { readonly [key: string]: TypeName };

export type SheetQueryConfig<ColumnType extends ColumnTypes> = {
    id: number;
    columnType: ColumnType;
};

export const createQueryConfig = <ColumnType extends ColumnTypes>(
    id: number,
    columnType: ColumnType
) => {
    return { id, columnType } as SheetQueryConfig<ColumnType>;
};
