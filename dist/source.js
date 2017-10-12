"use strict";
class Test {
    b() { return 4; }
}
function Debug(Base) {
    return class extends Base {
        a() { return 3; }
    };
}
class A extends Debug(Test) {
    z() {
        this.a();
    }
}
const a;
a.b();
a.a();
//# sourceMappingURL=source.js.map