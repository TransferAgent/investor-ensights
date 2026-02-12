module.exports = [
"[project]/node_modules/drizzle-zod/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createInsertSchema",
    ()=>createInsertSchema,
    "createSchemaFactory",
    ()=>createSchemaFactory,
    "createSelectSchema",
    ()=>createSelectSchema,
    "createUpdateSchema",
    ()=>createUpdateSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$table$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/drizzle-orm/table.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/drizzle-orm/utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$entity$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/drizzle-orm/entity.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$column$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/drizzle-orm/column.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$sql$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/drizzle-orm/sql/sql.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zod/lib/index.mjs [app-route] (ecmascript)");
;
;
const CONSTANTS = {
    INT8_MIN: -128,
    INT8_MAX: 127,
    INT8_UNSIGNED_MAX: 255,
    INT16_MIN: -32768,
    INT16_MAX: 32767,
    INT16_UNSIGNED_MAX: 65535,
    INT24_MIN: -8388608,
    INT24_MAX: 8388607,
    INT24_UNSIGNED_MAX: 16777215,
    INT32_MIN: -2147483648,
    INT32_MAX: 2147483647,
    INT32_UNSIGNED_MAX: 4294967295,
    INT48_MIN: -140737488355328,
    INT48_MAX: 140737488355327,
    INT48_UNSIGNED_MAX: 281474976710655,
    INT64_MIN: -9223372036854775808n,
    INT64_MAX: 9223372036854775807n,
    INT64_UNSIGNED_MAX: 18446744073709551615n
};
function isColumnType(column, columnTypes) {
    return columnTypes.includes(column.columnType);
}
function isWithEnum(column) {
    return 'enumValues' in column && Array.isArray(column.enumValues) && column.enumValues.length > 0;
}
const isPgEnum = isWithEnum;
const literalSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].union([
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].string(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].number(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].boolean(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].null()
]);
const jsonSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].union([
    literalSchema,
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].record(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].any()),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].any())
]);
const bufferSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].custom((v)=>v instanceof Buffer); // eslint-disable-line no-instanceof/no-instanceof
function columnToSchema(column, factory) {
    const z$1 = factory?.zodInstance ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"];
    const coerce = factory?.coerce ?? {};
    let schema;
    if (isWithEnum(column)) {
        schema = column.enumValues.length ? z$1.enum(column.enumValues) : z$1.string();
    }
    if (!schema) {
        // Handle specific types
        if (isColumnType(column, [
            'PgGeometry',
            'PgPointTuple'
        ])) {
            schema = z$1.tuple([
                z$1.number(),
                z$1.number()
            ]);
        } else if (isColumnType(column, [
            'PgGeometryObject',
            'PgPointObject'
        ])) {
            schema = z$1.object({
                x: z$1.number(),
                y: z$1.number()
            });
        } else if (isColumnType(column, [
            'PgHalfVector',
            'PgVector'
        ])) {
            schema = z$1.array(z$1.number());
            schema = column.dimensions ? schema.length(column.dimensions) : schema;
        } else if (isColumnType(column, [
            'PgLine'
        ])) {
            schema = z$1.tuple([
                z$1.number(),
                z$1.number(),
                z$1.number()
            ]);
        } else if (isColumnType(column, [
            'PgLineABC'
        ])) {
            schema = z$1.object({
                a: z$1.number(),
                b: z$1.number(),
                c: z$1.number()
            });
        } else if (isColumnType(column, [
            'PgArray'
        ])) {
            schema = z$1.array(columnToSchema(column.baseColumn, z$1));
            schema = column.size ? schema.length(column.size) : schema;
        } else if (column.dataType === 'array') {
            schema = z$1.array(z$1.any());
        } else if (column.dataType === 'number') {
            schema = numberColumnToSchema(column, z$1, coerce);
        } else if (column.dataType === 'bigint') {
            schema = bigintColumnToSchema(column, z$1, coerce);
        } else if (column.dataType === 'boolean') {
            schema = coerce === true || coerce.boolean ? z$1.coerce.boolean() : z$1.boolean();
        } else if (column.dataType === 'date') {
            schema = coerce === true || coerce.date ? z$1.coerce.date() : z$1.date();
        } else if (column.dataType === 'string') {
            schema = stringColumnToSchema(column, z$1, coerce);
        } else if (column.dataType === 'json') {
            schema = jsonSchema;
        } else if (column.dataType === 'custom') {
            schema = z$1.any();
        } else if (column.dataType === 'buffer') {
            schema = bufferSchema;
        }
    }
    if (!schema) {
        schema = z$1.any();
    }
    return schema;
}
function numberColumnToSchema(column, z, coerce) {
    let unsigned = column.getSQLType().includes('unsigned');
    let min;
    let max;
    let integer = false;
    if (isColumnType(column, [
        'MySqlTinyInt',
        'SingleStoreTinyInt'
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT8_MIN;
        max = unsigned ? CONSTANTS.INT8_UNSIGNED_MAX : CONSTANTS.INT8_MAX;
        integer = true;
    } else if (isColumnType(column, [
        'PgSmallInt',
        'PgSmallSerial',
        'MySqlSmallInt',
        'SingleStoreSmallInt'
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT16_MIN;
        max = unsigned ? CONSTANTS.INT16_UNSIGNED_MAX : CONSTANTS.INT16_MAX;
        integer = true;
    } else if (isColumnType(column, [
        'PgReal',
        'MySqlFloat',
        'MySqlMediumInt',
        'SingleStoreMediumInt',
        'SingleStoreFloat'
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT24_MIN;
        max = unsigned ? CONSTANTS.INT24_UNSIGNED_MAX : CONSTANTS.INT24_MAX;
        integer = isColumnType(column, [
            'MySqlMediumInt',
            'SingleStoreMediumInt'
        ]);
    } else if (isColumnType(column, [
        'PgInteger',
        'PgSerial',
        'MySqlInt',
        'SingleStoreInt'
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT32_MIN;
        max = unsigned ? CONSTANTS.INT32_UNSIGNED_MAX : CONSTANTS.INT32_MAX;
        integer = true;
    } else if (isColumnType(column, [
        'PgDoublePrecision',
        'MySqlReal',
        'MySqlDouble',
        'SingleStoreReal',
        'SingleStoreDouble',
        'SQLiteReal'
    ])) {
        min = unsigned ? 0 : CONSTANTS.INT48_MIN;
        max = unsigned ? CONSTANTS.INT48_UNSIGNED_MAX : CONSTANTS.INT48_MAX;
    } else if (isColumnType(column, [
        'PgBigInt53',
        'PgBigSerial53',
        'MySqlBigInt53',
        'MySqlSerial',
        'SingleStoreBigInt53',
        'SingleStoreSerial',
        'SQLiteInteger'
    ])) {
        unsigned = unsigned || isColumnType(column, [
            'MySqlSerial',
            'SingleStoreSerial'
        ]);
        min = unsigned ? 0 : Number.MIN_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
        integer = true;
    } else if (isColumnType(column, [
        'MySqlYear',
        'SingleStoreYear'
    ])) {
        min = 1901;
        max = 2155;
        integer = true;
    } else {
        min = Number.MIN_SAFE_INTEGER;
        max = Number.MAX_SAFE_INTEGER;
    }
    let schema = coerce === true || coerce?.number ? z.coerce.number() : z.number();
    schema = schema.min(min).max(max);
    return integer ? schema.int() : schema;
}
function bigintColumnToSchema(column, z, coerce) {
    const unsigned = column.getSQLType().includes('unsigned');
    const min = unsigned ? 0n : CONSTANTS.INT64_MIN;
    const max = unsigned ? CONSTANTS.INT64_UNSIGNED_MAX : CONSTANTS.INT64_MAX;
    const schema = coerce === true || coerce?.bigint ? z.coerce.bigint() : z.bigint();
    return schema.min(min).max(max);
}
function stringColumnToSchema(column, z, coerce) {
    if (isColumnType(column, [
        'PgUUID'
    ])) {
        return z.string().uuid();
    }
    let max;
    let regex;
    let fixed = false;
    if (isColumnType(column, [
        'PgVarchar',
        'SQLiteText'
    ])) {
        max = column.length;
    } else if (isColumnType(column, [
        'MySqlVarChar',
        'SingleStoreVarChar'
    ])) {
        max = column.length ?? CONSTANTS.INT16_UNSIGNED_MAX;
    } else if (isColumnType(column, [
        'MySqlText',
        'SingleStoreText'
    ])) {
        if (column.textType === 'longtext') {
            max = CONSTANTS.INT32_UNSIGNED_MAX;
        } else if (column.textType === 'mediumtext') {
            max = CONSTANTS.INT24_UNSIGNED_MAX;
        } else if (column.textType === 'text') {
            max = CONSTANTS.INT16_UNSIGNED_MAX;
        } else {
            max = CONSTANTS.INT8_UNSIGNED_MAX;
        }
    }
    if (isColumnType(column, [
        'PgChar',
        'MySqlChar',
        'SingleStoreChar'
    ])) {
        max = column.length;
        fixed = true;
    }
    if (isColumnType(column, [
        'PgBinaryVector'
    ])) {
        regex = /^[01]+$/;
        max = column.dimensions;
    }
    let schema = coerce === true || coerce?.string ? z.coerce.string() : z.string();
    schema = regex ? schema.regex(regex) : schema;
    return max && fixed ? schema.length(max) : max ? schema.max(max) : schema;
}
function getColumns(tableLike) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$table$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTable"])(tableLike) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTableColumns"])(tableLike) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getViewSelectedFields"])(tableLike);
}
function handleColumns(columns, refinements, conditions, factory) {
    const columnSchemas = {};
    for (const [key, selected] of Object.entries(columns)){
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$entity$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["is"])(selected, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$column$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Column"]) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$entity$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["is"])(selected, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$sql$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SQL"]) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$entity$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["is"])(selected, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$sql$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SQL"].Aliased) && typeof selected === 'object') {
            const columns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$table$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTable"])(selected) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$sql$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isView"])(selected) ? getColumns(selected) : selected;
            columnSchemas[key] = handleColumns(columns, refinements[key] ?? {}, conditions, factory);
            continue;
        }
        const refinement = refinements[key];
        if (refinement !== undefined && typeof refinement !== 'function') {
            columnSchemas[key] = refinement;
            continue;
        }
        const column = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$entity$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["is"])(selected, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$drizzle$2d$orm$2f$column$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Column"]) ? selected : undefined;
        const schema = column ? columnToSchema(column, factory) : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].any();
        const refined = typeof refinement === 'function' ? refinement(schema) : schema;
        if (conditions.never(column)) {
            continue;
        } else {
            columnSchemas[key] = refined;
        }
        if (column) {
            if (conditions.nullable(column)) {
                columnSchemas[key] = columnSchemas[key].nullable();
            }
            if (conditions.optional(column)) {
                columnSchemas[key] = columnSchemas[key].optional();
            }
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"].object(columnSchemas);
}
function handleEnum(enum_, factory) {
    const zod = factory?.zodInstance ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["z"];
    return zod.enum(enum_.enumValues);
}
const selectConditions = {
    never: ()=>false,
    optional: ()=>false,
    nullable: (column)=>!column.notNull
};
const insertConditions = {
    never: (column)=>column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
    optional: (column)=>!column.notNull || column.notNull && column.hasDefault,
    nullable: (column)=>!column.notNull
};
const updateConditions = {
    never: (column)=>column?.generated?.type === 'always' || column?.generatedIdentity?.type === 'always',
    optional: ()=>true,
    nullable: (column)=>!column.notNull
};
const createSelectSchema = (entity, refine)=>{
    if (isPgEnum(entity)) {
        return handleEnum(entity);
    }
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, selectConditions);
};
const createInsertSchema = (entity, refine)=>{
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, insertConditions);
};
const createUpdateSchema = (entity, refine)=>{
    const columns = getColumns(entity);
    return handleColumns(columns, refine ?? {}, updateConditions);
};
function createSchemaFactory(options) {
    const createSelectSchema = (entity, refine)=>{
        if (isPgEnum(entity)) {
            return handleEnum(entity, options);
        }
        const columns = getColumns(entity);
        return handleColumns(columns, refine ?? {}, selectConditions, options);
    };
    const createInsertSchema = (entity, refine)=>{
        const columns = getColumns(entity);
        return handleColumns(columns, refine ?? {}, insertConditions, options);
    };
    const createUpdateSchema = (entity, refine)=>{
        const columns = getColumns(entity);
        return handleColumns(columns, refine ?? {}, updateConditions, options);
    };
    return {
        createSelectSchema,
        createInsertSchema,
        createUpdateSchema
    };
}
;
 //# sourceMappingURL=index.mjs.map
}),
"[externals]/pg [external] (pg, cjs, [project]/node_modules/pg)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("pg-587764f78a6c7a9c", () => require("pg-587764f78a6c7a9c"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b12d566a._.js.map