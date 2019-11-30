# Typescript generator for intelligent TS, Mongoose, and GQL definitions

TODO might want to move to using decorators

## Allowed format

```
TypeName := "string" | "number" | "boolean" | "id" | "array" | SchemaName

{
    "SchemaName": {
        "fields": {
            "FieldName": {
                "type": TypeName,
                "required": true,
                "arrayType": TypeName
            } | TypeName
        },
        "extends": "ExtendsSchemaName"
    }
}
```

## Misc

- single inheritance only - a type cannot inherit from multiple base types
- `_id` handling is weird

## Bugs/TODO

- [ ] Order of definitions matter
- [x] Enums
- [ ] Default values
- [x] Export allGql in one go better
- [ ] Client queries
- [ ] Required objects `{ type: "SomeType", required: true }`
- [ ] roles on User should be of type UserRole but extensible. Rn it's `any`
