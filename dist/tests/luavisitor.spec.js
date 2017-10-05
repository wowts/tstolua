"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ava_1 = require("ava");
var ts = require("typescript");
var luavisitor_1 = require("../luavisitor");
var fs = require("fs");
var i = 0;
if (!fs.existsSync("testfiles"))
    fs.mkdirSync("testfiles");
function testTransform(t, source) {
    var dir = "testfiles/test" + (i++);
    var fileName = dir + "\\source.ts";
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir);
    fs.writeFileSync(fileName, source);
    var program = ts.createProgram([fileName], { module: ts.ModuleKind.CommonJS, emitDecoratorMetadata: false });
    t.deepEqual(program.getSyntacticDiagnostics().map(function (x) {
        return x.messageText + " at " + (x.file && x.start && x.file.getLineAndCharacterOfPosition(x.start).line);
    }), []);
    var sourceFile = program.getSourceFile(fileName);
    sourceFile.moduleName = "source";
    //const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, false);
    // TODO how to create the type checker without the program or how to create a program from a source file?
    var visitor = new luavisitor_1.LuaVisitor(sourceFile, program.getTypeChecker());
    visitor.traverse(sourceFile, 0, undefined);
    fs.unlinkSync(fileName);
    return visitor.getResult();
}
ava_1.test(function (t) {
    t.is(testTransform(t, "let a = 2 + 3;"), "local a = 2 + 3\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "a.b = a.c(a.d)"), "a.b = a:c(a.d)\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "if (!a != 4) {\n    b = 3.5;\n} else if (a == 4) {\n    b = 4 + (3 * 4);\n} else {\n    c = 4;\n}\n"), "if  not a ~= 4 then\n    b = 3.5\nelseif a == 4 then\n    b = 4 + (3 * 4)\nelse\n    c = 4\nend\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "for (let k = lualength(test); k >= 1; k += -1) {\n}"), "for k = #test, 1, -1 do\nend\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "class Test extends Base {\n        constructor() {\n            super(16);\n        }\n}"), "local Test = __class(Base, {\n    constructor = function(self)\n        Base.constructor(self, 16)\n    end,\n})\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "import __addon from \"addon\";\nlet [OVALE, Ovale] = __addon;\nimport { OvaleScripts } from \"./OvaleScripts\";\nlet a = OvaleScripts;\nimport Test from 'Test';\nexport const bla = 3;\n"), "local OVALE, Ovale = ...\nOvale.require(OVALE, Ovale, \"source\", { \"./OvaleScripts\", \"Test\" }, function(__exports, __OvaleScripts, Test)\nlocal a = __OvaleScripts.OvaleScripts\n__exports.bla = 3\nend)\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "let a = {\n        TEST: 'a',\n        [\"a\"]: 'b',\n        c: {\n            d: \"z\"\n        }\n    }\n    "), "local a = {\n    TEST = \"a\",\n    [\"a\"] = \"b\",\n    c = {\n        d = \"z\"\n    }\n}\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "class Test extends Base {\n    a = 3;\n    constructor(a) {\n        this.a = a;\n    }\n\n    bla() {\n        this.a = 4;\n    }\n}\n    "), "local Test = __class(Base, {\n    constructor = function(self, a)\n        self.a = 3\n        self.a = a\n    end,\n    bla = function(self)\n        self.a = 4\n    end,\n})\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "(a,b) => 18"), "function(a, b)\n    return 18\nend\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "do {\n        a = a + 1;\n    }\n    while (!(a > 5));\n    "), "repeat\n    a = a + 1\nuntil not ( not (a > 5))\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "return class extends Base {\n    value = 3;\n    constructor(...rest:any[]) {\n        super(...rest);\n\n    }\n    getValue() {\n        return this.value;\n    }\n}\n    "), "return __class(Base, {\n    constructor = function(self, ...)\n        self.value = 3\n        Base.constructor(self, ...)\n    end,\n    getValue = function(self)\n        return self.value\n    end,\n})\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "3 + 3"), "3 + 3\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "a = { 1: 'a' }"), "a = {\n    [1] = \"a\"\n}\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "`${'3'}${3}`"), "\"3\" .. 3\n");
});
ava_1.test.only(function (t) {
    t.is(testTransform(t, "`z${'3'}${3}`z"), "\"z\" .. \"3\" .. 3 .. \"z\"\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "function a(){\n    return new Test();\n}\nexport class Test {}\n"), "local __addonName, __addon = ...\n__addon.require(__addonName, __addon, \"source\", {}, function(__exports)\nlocal a = function()\n    return __exports.Test()\nend\n__exports.Test = __class(nil, {\n})\nend)\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "class Test {\n    a: (a) => number;\n    b(c):number {}\n    c() {\n        this.b(12);\n        this.a(13);\n    }\n    d = () => {\n        this.a(2);\n        this.b(14);\n    }\n}\nconst a:Test;\na.a(18);\na.b(23);\n"), "local Test = __class(nil, {\n    b = function(self, c)\n    end,\n    c = function(self)\n        self:b(12)\n        self.a(13)\n    end,\n    constructor = function(self)\n        self.d = function()\n            self.a(2)\n            self:b(14)\n        end\n    end\n})\nlocal a\na.a(18)\na:b(23)\n");
});
ava_1.test(function (t) {
    t.is(testTransform(t, "\ntype Constructor<T> = new(...args: any[]) => T;    \nclass Test {\n    b() { return 4 }\n}\nfunction Debug<T extends Constructor<{}>>(Base:T) {\n    return class extends Base {\n        a() { return 3 }\n    };\n}\nclass A extends Debug(Test) {\n    z(){\n        this.a();\n    }\n}\n\nconst a: A;\na.b();\na.a();\n"), "local Test = __class(nil, {\n    b = function(self)\n        return 4\n    end,\n})\nlocal Debug = function(Base)\n    return __class(Base, {\n        a = function(self)\n            return 3\n        end,\n    })\nend\nlocal A = __class(Debug(Test), {\n})\nlocal a\na:b()\na:a()\n");
});
//# sourceMappingURL=luavisitor.spec.js.map