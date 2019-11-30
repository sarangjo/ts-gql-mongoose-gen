import _ from "lodash";

////// Types //////
interface Definition {
  fields?: Record<string, any>;
  extends?: string;
  values?: Record<string, any>;
}

type processFn = (definition: Definition, name: string) => string;

////// Constants //////
const pods = new Set(["string", "number", "boolean", "id", "any"]);

////// TS //////
function toTypescriptType(inputType: string): string {
  if (pods.has(inputType)) {
    return inputType === "id" ? "string" : inputType;
  }
  return inputType;
}

export const processTsInterface: processFn = (definition, name) => {
  let ts: string;
  if (_.size(definition.fields)) {
    // Interface
    const extension = _.has(definition, "extends") ? " extends " + definition.extends : "";
    ts = `export interface ${name}${extension} {`;

    _.forEach(definition.fields, (typeInfo, fieldName) => {
      const separator = !_.isObjectLike(typeInfo) || !typeInfo.required ? "?" : "";
      let type = "";
      let ourTypeInfo = _.cloneDeep(typeInfo);
      if (!_.isObjectLike(ourTypeInfo)) {
        ourTypeInfo = { type: ourTypeInfo };
      }
      if (ourTypeInfo.type === "array") {
        type = `${toTypescriptType(ourTypeInfo.arrayType)}[]`;
      } else {
        type = toTypescriptType(ourTypeInfo.type);
      }

      ts += `${fieldName}${separator}:${type};`;
    });

    ts += "}";
  } else {
    // Type
    ts = `export type ${name} = ${definition.extends};`;
  }
  return ts;
};

export const processTsEnum: processFn = (definition, name) => {
  let ts = `export enum ${name} {`;
  _.forEach(definition.values, (value, key) => {
    ts += `${key}="${value}",`;
  });
  ts += "}";
  return ts;
};

////// Mongoose //////
function toMongooseType(inputType: string): string {
  if (pods.has(inputType)) {
    switch (inputType) {
      case "id":
        return "String";
      case "any":
        return "{}";
      default:
        return inputType.charAt(0).toUpperCase() + inputType.substr(1);
    }
  }
  return inputType + "Def";
}

// type, required only
function mongooseObj(obj: any): string {
  let str = "{";
  // array should be coalesced
  str += `type: ${obj.type},`;
  // TODO Mongoose required but allowed to be empty
  // str += obj.required ? `required: true,` : ``;
  str += "}";
  return str;
}

export const processMongooseInterface: processFn = (definition, name) => {
  let mgs = `export const ${name}Def: SchemaDefinition = {`;

  _.forEach(definition.fields, (typeInfo, fieldName) => {
    let type = "";

    if (!_.isObjectLike(typeInfo)) {
      // pod, or other type. Not array, not required
      type = toMongooseType(typeInfo);
    } else {
      // Convert types as we see fit
      const ourTypeInfo = _.cloneDeep(typeInfo);
      if (typeInfo.type === "array") {
        ourTypeInfo.type = `[${toMongooseType(typeInfo.arrayType)}]`;
      } else {
        ourTypeInfo.type = toMongooseType(typeInfo.type);
      }
      type = mongooseObj(ourTypeInfo);
    }

    mgs += `${fieldName}:${type},`;
  });

  mgs += "};";
  return mgs;
};

export const processMongooseEnum: processFn = (definition, name) => {
  let mgs = `export const ${name}Def: SchemaDefinition = {`;
  mgs += `type: String, enum: ${JSON.stringify(_.values(definition.values))}`;
  mgs += `}`;
  return mgs;
};

////// GraphQL //////
const graphqlDefinitions = {};

function toGraphqlType(inputType: string): string {
  if (pods.has(inputType)) {
    switch (inputType) {
      case "id":
        return "ID";
      case "number":
        return "Int";
      default:
        return inputType.charAt(0).toUpperCase() + inputType.substr(1);
    }
  }
  return inputType;
}

// Output gql
export const processGqlInterface: processFn = (definition, name) => {
  const typeDefs = [];
  // First check all extends fields
  if (_.has(definition, "extends")) {
    const extendsLines = graphqlDefinitions[definition.extends];
    typeDefs.push(`# START Inherited from ${definition.extends}`);
    typeDefs.push(...extendsLines);
    typeDefs.push(`# END Inherited from ${definition.extends}`);
    typeDefs.push("");
  }

  if (_.get(definition, "meta.dbBase")) {
    typeDefs.push(`_id: ID!`);
  }

  _.forEach(definition.fields, (typeInfo, fieldName) => {
    let type: string;

    if (!_.isObjectLike(typeInfo)) {
      // pod or other type. Not array, not required
      type = toGraphqlType(typeInfo);
    } else {
      if (typeInfo.type === "array") {
        // type array
        type = `[${toGraphqlType(typeInfo.arrayType)}!]`;
      } else {
        type = toGraphqlType(typeInfo.type);
      }
    }
    if (_.isObjectLike(typeInfo) && typeInfo.required) {
      type += "!";
    }

    typeDefs.push(`${fieldName}: ${type}`);
  });

  graphqlDefinitions[name] = typeDefs;

  const gql = [];
  gql.push(`type ${name} {`);
  gql.push(...typeDefs);
  gql.push("}");
  return gql.join("\n");
};

export const processGqlEnum: processFn = (definition, name) => {
  const gql = [];
  gql.push(`enum ${name} {`);
  _.forEach(definition.values, value => {
    gql.push(value);
  });
  gql.push("}");
  return gql.join("\n");
};

// Wrap with JS code that creates the single AllGql element
export const postprocessGql = (lines: string[]): string[] => {
  return ["export const AllGql = gql`", ...lines, "`;"];
};
