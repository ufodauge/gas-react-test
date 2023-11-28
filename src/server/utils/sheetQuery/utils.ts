import { ToActualType, TypeName } from "@/types/utils";

export const intoDefaultValue = <Name extends TypeName>(name: Name): ToActualType<Name> => {
    if (name === "string") return "";
    if (name === "number") return 0;
    if (name === "boolean") return false;
    if (name === "undefined") return undefined;
    if (name === "symbol") return Symbol();
    if (name === "object") return Object();
    if (name === "bigint") return BigInt(0);

    throw new Error("Unable to convert to type");
    
};
