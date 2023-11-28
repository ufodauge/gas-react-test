import { TypeName } from "@/types/utils";

export type SheetSchemaTemplate = { readonly [key: string]: TypeName };

export type SheetQueryConfig<Template extends SheetSchemaTemplate> = {
    id: number;
    template: Template;
};

export const createQueryConfig = <Template extends SheetSchemaTemplate>(
    id: number,
    template: Template
) => {
    return { id, template } as SheetQueryConfig<Template>;
};

