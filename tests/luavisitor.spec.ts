import { test } from "ava";
import * as ts from "typescript";
import { LuaVisitor } from "../luavisitor";

function testTransform(source: string) {
    const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, true);
    const visitor = new LuaVisitor(sourceFile);
    visitor.traverse(sourceFile, 0, undefined);
    return visitor.result;
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
