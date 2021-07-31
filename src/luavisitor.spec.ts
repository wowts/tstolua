import { test, expect } from "@jest/globals";
import { testTransform } from "./testhelpers/compiler";

test("simple assignation", () => {
    expect(testTransform("let a = 2 + 3;")).toBe(
        `local a = 2 + 3
`
    );
});

test("function call", () => {
    expect(testTransform("a.b = a.c(a.d)", true)).toBe(
        `a.b = a.c(a.d)
`
    );
});

test("if else", () => {
    expect(
        testTransform(
            `if (!a != 4) {
    b = 3.5;
} else if (a == 4) {
    b = 4 + (3 * 4);
} else {
    c = 4;
}
`
        )
    ).toBe(
        `if  not a ~= 4 then
    b = 3.5
elseif a == 4 then
    b = 4 + (3 * 4)
else
    c = 4
end
`
    );
});

test("table iteration", () => {
    expect(
        testTransform(
            `import { lualength } from "@wowts/lua";
            for (let k = lualength(test); k >= 1; k += -1) {
}`
        )
    ).toBe(
        `for k = #test, 1, -1 do
end
`
    );
});

test("lualength", () => {
    expect(
        testTransform(
            `import { lualength as length } from "@wowts/lua";
const a = length({})`
        )
    ).toBe(
        `local a = #{}
`
    );
});

test("truthy and pack", () => {
    expect(
        testTransform(`import { truthy, pack } from "@wowts/lua";
const a = pack(1, 2, 3)
const b = truthy({})`)
    ).toBe(
        `local a = {1, 2, 3}
local b = {}
`
    );
});

test("pack with args", () => {
    expect(
        testTransform(
            `import { pack } from "@wowts/lua";
function test(...params: any[]) {
    const a = pack(...(params as any));
}`
        )
    ).toBe(
        `local function test(...)
    local a = {...}
end
`
    );
});

test("class inheritance", () => {
    expect(
        testTransform(
            `class Test extends Base {
        constructor() {
            super(16);
        }
}`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(Base, {
    constructor = function(self)
        Base.constructor(self, 16)
    end,
})
`
    );
});

// XXX need to mock PackageExtras for this test
test.skip("imports external @wowts module", () => {
    expect(
        testTransform(
            `import aceEvent from "@wowts/ace_event-3.0";
let a = aceEvent;
`
        )
    ).toBe(
        `local __imports = {}
__imports.aceEvent = LibStub:GetLibrary("AceEvent-3.0", true)
local aceEvent = __imports.aceEvent
local a = aceEvent
`
    );
});

test("imports local module", () => {
    expect(
        testTransform(
            `import { OvaleScripts } from "./OvaleScripts";
let a = OvaleScripts;
`
        )
    ).toBe(
        `local __imports = {}
__imports.__OvaleScripts = LibStub:GetLibrary("test/OvaleScripts")
__imports.OvaleScripts = __imports.__OvaleScripts.OvaleScripts
local OvaleScripts = __imports.OvaleScripts
local a = OvaleScripts
`
    );
});

test("imports unused symbol", () => {
    expect(
        testTransform(
            `import { OvaleScripts } from "./OvaleScripts";
export const bla = 3;
`
        )
    ).toBe(
        `local __exports = LibStub:NewLibrary("test/source", 1)
if not __exports then return end
__exports.bla = 3
`
    );
});

test("new object of imported class", () => {
    expect(
        testTransform(
            `import { OvaleScripts } from "./OvaleScripts";
let a = new OvaleScripts()
`
        )
    ).toBe(
        `local __imports = {}
__imports.__OvaleScripts = LibStub:GetLibrary("test/OvaleScripts")
__imports.OvaleScripts = __imports.__OvaleScripts.OvaleScripts
local OvaleScripts = __imports.OvaleScripts
local a = __imports.OvaleScripts()
`
    );
});

test("import additions come before local aliasing", () => {
    expect(
        testTransform(
            `import { A } from "./A";
let a = A;
import { B } from "./B";
let b = B;
`
        )
    ).toBe(
        `local __imports = {}
__imports.__A = LibStub:GetLibrary("test/A")
__imports.A = __imports.__A.A
__imports.__B = LibStub:GetLibrary("test/B")
__imports.B = __imports.__B.B
local A = __imports.A
local B = __imports.B
local a = A
local b = B
`
    );
});

test("litteral object", () => {
    expect(
        testTransform(
            `let a = {
        TEST: 'a',
        ["a"]: 'b',
        c: {
            d: "z"
        }
    }
    `
        )
    ).toBe(
        `local a = {
    TEST = "a",
    ["a"] = "b",
    c = {
        d = "z"
    }
}
`
    );
});

test("class inheritance with property access", () => {
    expect(
        testTransform(
            `class Test extends Base {
    a = 3;
    constructor(a) {
        this.a = a;
    }

    bla() {
        this.a = 4;
    }
}
    `
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(Base, {
    constructor = function(self, a)
        self.a = 3
        self.a = a
    end,
    bla = function(self)
        self.a = 4
    end,
})
`
    );
});

test("simple lambda function", () => {
    expect(testTransform(`(a,b) => 18`)).toBe(
        `function(a, b)
    return 18
end
`
    );
});

test("do while", () => {
    expect(
        testTransform(
            `do {
        a = a + 1;
    }
    while (!(a > 5));
    `
        )
    ).toBe(
        `repeat
    a = a + 1
until not ( not (a > 5))
`
    );
});

test("dynamic class", () => {
    expect(
        testTransform(
            `return class extends Base {
    value = 3;
    constructor(...rest:any[]) {
        super(...rest);

    }
    getValue() {
        return this.value;
    }
}
    `
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
return __class(Base, {
    constructor = function(self, ...)
        self.value = 3
        Base.constructor(self, ...)
    end,
    getValue = function(self)
        return self.value
    end,
})
`
    );
});

test("+ opereator", () => {
    expect(testTransform("3 + 3")).toBe("3 + 3\n");
});

test("for of with unused keys", () => {
    expect(testTransform("for (const [] of toto) {}")).toBe(
        "for _ in toto do\nend\n"
    );
});

test("initialize an array with a number as key", () => {
    expect(testTransform("a = { 1: 'a' }")).toBe(
        `a = {
    [1] = "a"
}
`
    );
});

test("simple string template", () => {
    expect(testTransform("`${'3'}${3}`")).toBe('"3" .. 3\n');
});

test("more complex template string", () => {
    expect(testTransform("`z${'3'}${3}z`")).toBe('"z" .. "3" .. 3 .. "z"\n');
});

test("string template with parenthesis", () => {
    expect(testTransform("`z${2 + 3}`")).toBe('"z" .. (2 + 3)\n');
});

test("function that returns a new object that is declared after the call", () => {
    expect(
        testTransform(
            `function a(){
    return new Test();
}
export class Test {}
`
        )
    ).toBe(
        `local __exports = LibStub:NewLibrary("test/source", 1)
if not __exports then return end
local __class = LibStub:GetLibrary("tslib").newClass
local function a()
    return __exports.Test()
end
__exports.Test = __class(nil, {
})
`
    );
});

test("class with methods", () => {
    expect(
        testTransform(
            `class Test {
    a: (a) => number;
    b(c):number {}
    c() {
        this.b(12);
        this.a(13);
    }
    d = () => {
        this.a(2);
        this.b(14);
    }
}
const a:Test;
a.a(18);
a.b(23);
`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(nil, {
    b = function(self, c)
    end,
    c = function(self)
        self:b(12)
        self.a(13)
    end,
    constructor = function(self)
        self.d = function()
            self.a(2)
            self:b(14)
        end
    end
})
local a
a.a(18)
a:b(23)
`
    );
});

test.skip("class declaration with class extension", () => {
    expect(
        testTransform(
            `
type Constructor<T> = new(...args: any[]) => T;    
class Test {
    b() { return 4 }
}
function Debug<T extends Constructor<{}>>(Base:T) {
    return class extends Base {
        a() { return 3 }
    };
}
class A extends Debug(Test) {
    z() {
        this.a();
    }
}

function testCall(a: A) {
    a.b();
    a.a();
}
`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(nil, {
    b = function(self)
        return 4
    end,
})
local function Debug(Base)
    return __class(Base, {
        a = function(self)
            return 3
        end,
    })
end
local A = __class(Debug(Test), {
    z = function(self)
        self:a()
    end,
})
local function testCall(a)
    a:b()
    a:a()
end
`
    );
});

test("imports mock modules", () => {
    expect(
        testTransform(
            `import { a, b } from "@wowts/table";
import { c } from "@wowts/lua";
const z = a;
c();
    `
        )
    ).toBe(
        `local a = table.a
local c = c
local z = a
c()
`
    );
});

test("class with inheritance but no explicit constructor", () => {
    expect(
        testTransform(
            `class Test extends BaseClass {
    v = true
}`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(BaseClass, {
    constructor = function(self, ...)
        BaseClass.constructor(self, ...)
        self.v = true
    end
})
`
    );
});

test("class with interface inheritance but no explicit constructor", () => {
    expect(
        testTransform(
            `class Test implements Interface {
    v = true
}`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(nil, {
    constructor = function(self)
        self.v = true
    end
})
`
    );
});

test("add strings", () => {
    expect(testTransform(`"a" + 3`)).toBe(
        `"a" .. 3
`
    );
});

test("class with static property", () => {
    expect(
        testTransform(
            `class Test {
    static v = true;
    static x = 2;
    static w;
}`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(nil, {
    v = true,
    x = 2,
})
`
    );
});

test("class with static property and constructor", () => {
    expect(
        testTransform(
            `class Test {
    static v = true;
    static x = 2;
    static w;
    constructor() {
        let a = 2;
    }
}`
        )
    ).toBe(
        `local __class = LibStub:GetLibrary("tslib").newClass
local Test = __class(nil, {
    v = true,
    x = 2,
    constructor = function(self)
        local a = 2
    end,
})
`
    );
});

test("+=", () => {
    expect(
        testTransform(
            `let a = 3;
a += 5;`
        )
    ).toBe(
        `local a = 3
a = a + 5
`
    );
});

test("+= with strings", () => {
    expect(
        testTransform(
            `let a = "3";
a += "5";`
        )
    ).toBe(
        `local a = "3"
a = a .. "5"
`
    );
});

test("-=", () => {
    expect(
        testTransform(
            `let a = 3;
a -= 5;`
        )
    ).toBe(
        `local a = 3
a = a - 5
`
    );
});

test("-= with parenthesis", () => {
    expect(
        testTransform(
            `let a = 3;
a -= 5 + 2;`
        )
    ).toBe(
        `local a = 3
a = a - (5 + 2)
`
    );
});

test("object literal with string keys", () => {
    expect(testTransform(`const a = { "foo": "bar", bar: "foo" }`)).toBe(
        `local a = {
    ["foo"] = "bar",
    bar = "foo"
}
`
    );
});

test("object literal with number keys", () => {
    expect(testTransform(`const a = { 2: "bar" }`)).toBe(
        `local a = {
    [2] = "bar"
}
`
    );
});

test("forward reference to local function", () => {
    expect(
        testTransform(
            `function a() {
    f(2);
}
function f(i: number) {
    return i * i;
}`
        )
    ).toBe(
        `local f
local function a()
    f(2)
end
f = function(i)
    return i * i
end
`
    );
});

test("cast on left side of an assignement", () => {
    expect(
        testTransform(
            `let a: string;
(<any>a) = "toto";`
        )
    ).toBe(
        `local a
a = "toto"
`
    );
});

test("ternary on reference type", () => {
    expect(
        testTransform(
            `let a = { a: 3 };
const b = true ? a : 2;`
        )
    ).toBe(
        `local a = {
    a = 3
}
local b = (true and a) or 2
`
    );
});

test("ternary on value type", () => {
    expect(testTransform(`const b = true ? 3 : 2;`)).toBe(
        `local __tslib = LibStub:GetLibrary("tslib")
local __ternaryWrap = __tslib.ternaryWrap
local __ternaryUnwrap = __tslib.ternaryUwrap
local b = __ternaryUnwrap((true and __ternaryWrap(3)) or 2)
`
    );
});

test("increment in a loop", () => {
    expect(
        testTransform(
            `let a = 0;
    for (let i = 0; i<5; i ++) {
        a = a + 1;
    }`
        )
    ).toBe(
        `local a = 0
for i = 0, 5, 1 do
    a = a + 1
end
`
    );
});

test("const enum", () => {
    expect(
        testTransform(
            `const enum Test {
        One,
        Two
}
    let toto: Test = Test.Two;
`
        )
    ).toBe(
        `local toto = 1
`
    );
});

test("const enum with initializer", () => {
    expect(
        testTransform(
            `const enum Test {
        One = 256,
        Two = 512
}
    let toto: Test = Test.Two;
`
        )
    ).toBe(
        `local toto = 512
`
    );
});

test("variadic parameters", () => {
    expect(
        testTransform(
            `function test(a: string, ...params: string[]) {
    blabla(params);
}
`
        )
    ).toBe(
        `local function test(a, ...)
    blabla(...)
end
`
    );
});

test("version constant string", () => {
    expect(
        testTransform(`import { version } from "@wowts/lua";
const toto = version;
if (toto) {
    const version = "z";
    test(version);
} `)
    ).toBe(`local toto = "1"
if toto then
    local version = "z"
    test(version)
end
`);
});
