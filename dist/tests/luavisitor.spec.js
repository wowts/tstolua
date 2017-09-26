"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ava_1 = require("ava");
var ts = require("typescript");
var luavisitor_1 = require("../luavisitor");
function testTransform(source) {
    var sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, true);
    var visitor = new luavisitor_1.LuaVisitor(sourceFile);
    visitor.traverse(sourceFile, 0, undefined);
    return visitor.result;
}
ava_1.test(function (t) {
    t.is(testTransform("let a = 2 + 3;"), "local a = 2 + 3\n");
});
ava_1.test(function (t) {
    t.is(testTransform("a.b = a.c(a.d)"), "a.b = a:c(a.d)\n");
});
ava_1.test(function (t) {
    t.is(testTransform("if (!a != 4) {\n    b = 3.5;\n} else if (a == 4) {\n    b = 4 + (3 * 4);\n} else {\n    c = 4;\n}\n"), "if  not a ~= 4 then\n    b = 3.5\nelseif a == 4 then\n    b = 4 + (3 * 4)\nelse\n    c = 4\nend\n");
});
ava_1.test(function (t) {
    t.is(testTransform("for (let k = lualength(test); k >= 1; k += -1) {\n}"), "for k = #test, 1, -1 do\nend\n");
});
//# sourceMappingURL=luavisitor.spec.js.map