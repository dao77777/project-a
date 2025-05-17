import ts from "typescript";
import fs from "fs";
import path from "path";

export const getSchemaNames = (file: string) => {
  const schemaFilePath = path.resolve(__dirname, file);

  const fileContent = fs.readFileSync(schemaFilePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    schemaFilePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const pgTableVariables: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node)) {
      const initializer = node.initializer;
      if (
        initializer &&
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === "pgTable"
      ) {
        if (ts.isIdentifier(node.name)) {
          pgTableVariables.push(
            node.name.text.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return pgTableVariables;
};
