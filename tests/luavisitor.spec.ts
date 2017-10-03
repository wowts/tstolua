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
    t.is(testTransform(`class Test extends Base {
        constructor() {
            super(16);
        }
}`), `local Test = __class(Base, {
    constructor = function()
        Base.constructor(self, 16)
    end
})
`); 
});

test(t => {
    t.is(testTransform(`import __addon from "addon";
let [OVALE, Ovale] = __addon;
import { OvaleScripts } from "./OvaleScripts";
let a = OvaleScripts;
import Test from 'Test';
export const bla = 3;
`), `local OVALE, Ovale = ...
require(OVALE, Ovale, "source", { "./OvaleScripts", "Test" }, function(__exports, __OvaleScripts, Test)
local a = __OvaleScripts.OvaleScripts
__exports.bla = 3
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
    `), `local Test = __class(Base, {
    constructor = function(self, a)
        self.a = 3
        self.a = a
    end,
    bla = function()
        self.a = 4
    end,
})
`)
});

test(t => {
    t.is(testTransform(`(a,b) => 18`), `function(a, b)
    return 18
end
`);
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


test(t => {
    t.is(testTransform(`return class extends Base {
    value = 3;
    constructor(...rest:any[]) {
        super(...rest);

    }
    getValue() {
        return this.value;
    }
}
    `), `return __class(Base, {
    constructor = function(self, ...)
        self.value = 3
        Base.constructor(self, ...)
    end,
    getValue = function(self)
        return self.value
    end,
})
`);
});