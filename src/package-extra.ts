import path from "path";
import fs from "fs";

export interface PackageExtra {
    isGlobal?: boolean;
    name?: string;
    svn?: string;
    git?: string;
    entry?: string;
    parent?: string;
    title?: string;
    interface?: string;
    savedVariables?: string;
}

export function getEntryInclude(packageExtra: PackageExtra) {
    if (!packageExtra.entry) return "";
    if (packageExtra.entry.endsWith(".lua")) {
        return `<Script file="${
            packageExtra.parent ?? packageExtra.name
        }\\${packageExtra.entry.replace(/\//g, "\\")}"/>`;
    }
    return `<Include file="${
        packageExtra.parent ?? packageExtra.name
    }\\${packageExtra.entry.replace(/\//g, "\\")}"/>`;
}

export class PackageExtras {
    /** Packages by module name */
    extra = new Map<string, PackageJson>();

    /** Packages by lua name */
    packageByLuaName = new Map<string, PackageJson>();

    getExtras(name: string) {
        let packageJson = this.extra.get(name);
        if (packageJson) return packageJson;
        packageJson = require(`${name}/package.json`) as PackageJson;
        packageJson.lua ||= {};
        packageJson.referencedBy = {};
        packageJson.references = [];
        packageJson.dependencies ||= {};
        const extras = packageJson.lua;
        extras.name = extras.name || getAppName(name);
        extras.entry ||= "files.xml";
        this.extra.set(name, packageJson);
        this.packageByLuaName.set(extras.name, packageJson);
        return packageJson;
    }
}

/** Remove the team's name, and transform to PascalCase if there is a _ in the name */
export function getAppName(input: string) {
    let moduleName = input.replace(/^@\w+\//, "");
    if (moduleName.indexOf("_") >= 0) {
        moduleName = moduleName.replace(/_db/g, "DB");
        moduleName = moduleName.replace(/_gui/g, "GUI");
        moduleName = moduleName.replace(/_(\w)/g, (_, x) => x.toUpperCase());
        moduleName = moduleName.replace(/^\w/, (x) => x.toUpperCase());
    }
    return moduleName;
}

export function getModuleName(input: string) {
    let moduleName = input.replace(
        /([a-z])([A-Z])/g,
        (_, a: string, b: string) => `${a}_${b.toLowerCase()}`
    );
    return `@wowts/${moduleName.toLowerCase()}`;
}

export interface PackageJson {
    version: string;
    name: string;
    dependencies: Record<string, string>;
    references: PackageJson[];
    referencedBy: Record<string, PackageJson>;
    optionalDependencies?: Record<string, string>;
    lua: PackageExtra;
    description?: string;
    author?: string;
    contributors?: string[];
}

export function parsePackage(configFileName: string) {
    const packageFileName = path.join(
        path.dirname(configFileName),
        "package.json"
    );
    const packageFile = JSON.parse(
        fs.readFileSync(packageFileName).toString()
    ) as PackageJson;
    const version: string = packageFile.version;
    const match = version.match(/(\d+)(?:\.(\d+))(?:\.(\d+))/);
    let major: string, minor: string, patch: string;
    let appVersion = 0;
    if (match) {
        [, major, minor, patch] = match;
        appVersion =
            (parseInt(major) * 100 + parseInt(minor)) * 100 + parseInt(patch);
    } else {
        console.error(`Can't parse package.json version number ${version}`);
        process.exit(1);
    }
    packageFile.lua = packageFile.lua || {};
    packageFile.dependencies ||= {};
    const appName: string = getAppName(packageFile.name);
    return Object.assign({ appName, appVersion }, packageFile);
}
