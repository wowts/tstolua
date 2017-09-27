import { test } from "ava";
import * as ts from "typescript";
import { LuaVisitor } from "../luavisitor";

function testTransform(source: string) {
    const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, true);
    const visitor = new LuaVisitor(sourceFile);
    visitor.traverse(sourceFile, 0, undefined);
    return visitor.getResult();
}

test(t => {
    t.is(testTransform("let a = 2 + 3;"), `local a = 2 + 3
`);
});

test(t =>  {
    t.is(testTransform("a.b = a.c(a.d)"), `a.b = a:c(a.d)
`);
});

test(t => {
    t.is(testTransform(`if (!a != 4) {
    b = 3.5;
} else if (a == 4) {
    b = 4 + (3 * 4);
} else {
    c = 4;
}
`),`if  not a ~= 4 then
    b = 3.5
elseif a == 4 then
    b = 4 + (3 * 4)
else
    c = 4
end
`);
});


test(t => {
    t.is(testTransform(`for (let k = lualength(test); k >= 1; k += -1) {
}`), `for k = #test, 1, -1 do
end
`);
});

test(t => {
    t.is(testTransform(`import __addon from "addon";
let [OVALE, Ovale] = __addon;
import { OvaleScripts } from "./OvaleScripts";
let a = OvaleScripts;
import Test from 'Test';
`), `local OVALE, Ovale = ...
require(OVALE, Ovale, "source", { "./OvaleScripts", "Test" }, function(__exports, __OvaleScripts, Test)
local a = __OvaleScripts.OvaleScripts
end))
`);
});


test(t => {
    t.is(testTransform(`let a = {
        TEST: 'a',
        ["a"]: 'b',
        c: {
            d: "z"
        }
    }
    `), `local a = {
    TEST = "a",
    ["a"] = "b",
    c = {
        d = "z"
    }
}
`)
});

test(t => {
    t.is(testTransform(`class Test extends Base {
    a = 3;
    constructor(a) {
        this.a = a;
    }

    bla() {
        this.a = 4;
    }
}
    `), `local Test = __class(Base)
function Test:constructor(a)
    self.a = 3
    self.a = a
end
function Test:bla()
    self.a = 4
end
`)
});



test(t => {
    t.is(testTransform(`do {
        a = a + 1;
    }
    while (!(a > 5));
    `), `repeat
    a = a + 1
until not ( not (a > 5))
`);
});