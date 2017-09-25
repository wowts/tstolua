import * as ts from "typescript";
import * as fs from "fs";
import { LuaVisitor } from "./luavisitor";
const sourceFile = ts.createSourceFile("../ovale-ts/sample.ts", fs.readFileSync("../ovale-ts/sample.ts").toString(), ts.ScriptTarget.ES2015, true);

const luaVisitor = new LuaVisitor();
luaVisitor.traverse(sourceFile, 0);

if (!fs.existsSync("../ovale-ts/dist")) fs.mkdirSync("../ovale-ts/dist");
fs.writeFileSync("../ovale-ts/dist/sample.lua", luaVisitor.result);

for (const error of luaVisitor.errors) {
    console.error(error);
}
