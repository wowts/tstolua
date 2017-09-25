import { test } from "ava";
import * as ts from "typescript";
import { LuaVisitor } from "../luavisitor";

function testTransform(source: string) {
    const visitor = new LuaVisitor();
    const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.ES2015, true);
    visitor.traverse(sourceFile, 0);
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