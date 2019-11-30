import fs from "fs";
import _ from "lodash";
import log from "loglevel";
import path from "path";
import prettier from "prettier";

import * as proc from "./processor";

////// Types //////

interface Node {
  name: string;
  extendedBy: Node[];
}

////// Constants //////
log.setLevel("debug");
const PRETTIFY = true;
const OUTPUT_PATH = path.join(__dirname, "output.ts");
const JSON_PATH = path.join(__dirname, "json");
const headerLines = [
  `// DO NOT EDIT. Generated file`,
  `import gql from "graphql-tag"`,
  `import { SchemaDefinition } from "mongoose";`,
];

////// Globals //////
const typeTree: Node = {
  name: "",
  extendedBy: [],
};
const lines: string[] = [];
const gqlLines: string[] = [];
let model: Record<string, any>;

////// Functions //////

function findNode(curr: Node, name: string): Node | undefined {
  if (curr.name === name) {
    return curr;
  }
  let found: Node | undefined;
  _.some(curr.extendedBy, child => {
    found = findNode(child, name);
    return !!found;
  });
  return found;
}

// Builds up rootNode inheritance tree
// TODO perhaps return?
const preprocessGql = (definition: Record<string, any>, name: string) => {
  if (findNode(typeTree, name)) {
    // already processed, skip
    return;
  }

  let baseNode = typeTree;
  if (_.has(definition, "extends")) {
    // Check to see if parent type is already in our tree
    const baseName = (definition as any).extends;
    const extendsNode = findNode(typeTree, baseName);
    if (extendsNode) {
      baseNode = extendsNode;
    } else {
      // if it's not already in our tree, make sure it exists later in the
      if (_.find(model, ({}, name2) => name2 === baseName)) {
        // Recursively preprocess the parent type
        preprocessGql(model[baseName], baseName);
        baseNode = findNode(typeTree, baseName);
      } else {
        throw new Error(
          `Broken inheritance tree: ${name} extends ${baseName}, which does not exist.`
        );
      }
    }
  }
  baseNode.extendedBy.push({
    name,
    extendedBy: [],
  });
};

function process({ name, extendedBy }: Node) {
  // Process self
  if (_.isEmpty(name)) {
    // root node!
  } else {
    const definition = model[name];
    if (_.has(definition, "fields")) {
      lines.push(proc.processTsInterface(definition, name));
      lines.push(proc.processMongooseInterface(definition, name));
      gqlLines.push(proc.processGqlInterface(definition, name));
    } else if (_.has(definition, "values")) {
      lines.push(proc.processTsEnum(definition, name));
      lines.push(proc.processMongooseEnum(definition, name));
      gqlLines.push(proc.processGqlEnum(definition, name));
    } else {
      throw new Error("Invalid type");
    }
  }

  // Process children
  _.forEach(extendedBy, process);
}

// Combine all into a single gql`` element and add to lines
function postprocessGql() {
  lines.push(...proc.postprocessGql(gqlLines));
}

function main() {
  // header
  lines.push(...headerLines);

  // TODO order shouldn't matter, but it does
  const files = fs.readdirSync(JSON_PATH).map(f => require(path.join(JSON_PATH, f)));
  model = _.assign({}, ...files);

  // First, build up the tree of dependencies for graphql. We only care about the "extends" thing
  // top level defs don't have any dependencies
  _.forEach(model, preprocessGql);

  // Recursively process rootNode
  process(typeTree);

  postprocessGql();

  fs.writeFileSync(
    OUTPUT_PATH,
    PRETTIFY ? prettier.format(lines.join("\n"), { parser: "typescript" }) : lines.join("\n")
  );
  log.info("Done writing to", OUTPUT_PATH);
}

main();
