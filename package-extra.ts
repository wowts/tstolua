export interface PackageExtra {
    isGlobal?: boolean;
    name?: string;
}

/** Remove the team's name, and transform to PascalCase if there is a _ in the name */
export function getAppName(input: string) {
    let moduleName = input.replace(/^@\w+\//, "");
    if (moduleName.indexOf("_") >= 0) {
        moduleName = moduleName.replace(/_db/g, "DB");
        moduleName = moduleName.replace(/_gui/g, "GUI");
        moduleName = moduleName.replace(/_(\w)/g, (_,x) => x.toUpperCase());
        moduleName = moduleName.replace(/^\w/, x => x.toUpperCase());
    }
    return moduleName;
}

export class PackageExtras {
    extra = new Map<string, PackageExtra>();

    getExtras(name: string) {
        let extras = this.extra.get(name);
        if (extras) return extras;
        const pkg = require(`${name}/package.json`);
        extras = <PackageExtra>pkg.lua || {};
        extras.name = extras.name || getAppName(name);
        this.extra.set(name, extras);
        return extras;
    }
}