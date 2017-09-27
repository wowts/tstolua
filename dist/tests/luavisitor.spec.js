"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ava_1 = require("ava");
var ts = require("typescript");
var luavisitor_1 = require("../luavisitor");
function testTransform(source) {
    var sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, true);
    var visitor = new luavisitor_1.LuaVisitor(sourceFile);
    visitor.traverse(sourceFile, 0, undefined);
    return visitor.getResult();
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
ava_1.test(function (t) {
    t.is(testTransform("import __addon from \"addon\";\nlet [OVALE, Ovale] = __addon;\nimport { OvaleScripts } from \"./OvaleScripts\";\nlet a = OvaleScripts;\nimport Test from 'Test';\n"), "local OVALE, Ovale = ...\nrequire(OVALE, Ovale, \"source\", { \"./OvaleScripts\", \"Test\" }, function(__exports, __OvaleScripts, Test)\nlocal a = __OvaleScripts.OvaleScripts\nend))\n");
});
ava_1.test(function (t) {
    t.is(testTransform("let a = {\n        TEST: 'a',\n        [\"a\"]: 'b',\n        c: {\n            d: \"z\"\n        }\n    }\n    "), "local a = {\n    TEST = \"a\",\n    [\"a\"] = \"b\",\n    c = {\n        d = \"z\"\n    }\n}\n");
});
ava_1.test(function (t) {
    t.is(testTransform("class Test extends Base {\n    a = 3;\n    constructor(a) {\n        this.a = a;\n    }\n\n    bla() {\n        this.a = 4;\n    }\n}\n    "), "local Test = __class(Base)\nfunction Test:constructor(a)\n    self.a = 3\n    self.a = a\nend\nfunction Test:bla()\n    self.a = 4\nend\n");
});
ava_1.test(function (t) {
    t.is(testTransform("do {\n        a = a + 1;\n    }\n    while (!(a > 5));\n    "), "repeat\n    a = a + 1\nuntil not ( not (a > 5))\n");
});
//# sourceMappingURL=luavisitor.spec.js.map