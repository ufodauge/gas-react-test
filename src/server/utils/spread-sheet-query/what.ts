
// ケース 1
type TypeA<T> = T extends readonly string[]
    ? {
          readonly [key in T[number]]: string;
      }
    : never;

export const funcA = <T extends readonly string[]>(
    arr: T,
    dictA: TypeA<T>
) => {
    dictA[arr[0]]
};

// --------------------------------------------------
// ケース 2
type TypeB<T extends readonly string[]> = {
    readonly [key in T[number]]: string;
};

export const funcB = <T extends readonly string[]>(
    arr: T,
    dictB: TypeB<T>
) => {
    dictB[arr[0]]
//  ^^^^^^^^^^^^^^^^^
// 型 'string' の式を使用して型 'TypeB<T>' に
// インデックスを付けることはできないため、
// 要素は暗黙的に 'any' 型になります。
// 型 'string' のパラメーターを持つインデックス
// シグネチャが型 'TypeB<T>' に
// 見つかりませんでした。ts(7053)
};


