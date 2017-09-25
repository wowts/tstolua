"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var fs = require("fs");
var luavisitor_1 = require("./luavisitor");
var sourceFile = ts.createSourceFile("../ovale-ts/sample.ts", fs.readFileSync("../ovale-ts/sample.ts").toString(), ts.ScriptTarget.ES2015, true);
var luaVisitor = new luavisitor_1.LuaVisitor();
luaVisitor.traverse(sourceFile, 0);
if (!fs.existsSync("../ovale-ts/dist"))
    fs.mkdirSync("../ovale-ts/dist");
fs.writeFileSync("../ovale-ts/dist/sample.lua", luaVisitor.result);
for (var _i = 0, _a = luaVisitor.errors; _i < _a.length; _i++) {
    var error = _a[_i];
    console.error(error);
}
//# sourceMappingURL=index.js.map