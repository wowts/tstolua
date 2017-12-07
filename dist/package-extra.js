"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Remove the team's name, and transform to PascalCase if there is a _ in the name */
function getAppName(input) {
    let moduleName = input.replace(/^@\w+\//, "");
    if (moduleName.indexOf("_") >= 0) {
        moduleName = moduleName.replace(/_db/g, "DB");
        moduleName = moduleName.replace(/_gui/g, "GUI");
        moduleName = moduleName.replace(/_(\w)/g, (_, x) => x.toUpperCase());
        moduleName = moduleName.replace(/^\w/, x => x.toUpperCase());
    }
    return moduleName;
}
exports.getAppName = getAppName;
class PackageExtras {
    constructor() {
        this.extra = new Map();
    }
    getExtras(name) {
        let extras = this.extra.get(name);
        if (extras)
            return extras;
        const pkg = require(`${name}/package.json`);
        extras = pkg.lua || {};
        extras.name = extras.name || getAppName(name);
        this.extra.set(name, extras);
        return extras;
    }
}
exports.PackageExtras = PackageExtras;
//# sourceMappingURL=package-extra.js.map