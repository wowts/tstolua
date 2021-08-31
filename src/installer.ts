import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmdirSync,
    statSync,
    unlinkSync,
    write,
    writeFileSync,
} from "fs";
import { dirname, join } from "path";
import {
    getEntryInclude,
    getModuleName,
    PackageExtras,
    PackageJson,
} from "./package-extra";
import { createClient, FileStat, WebDAVClient } from "webdav";
import degit from "degit";
import child_process from "child_process";

function exec(command: string) {
    return new Promise((fulfil, reject) => {
        child_process.exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }

            fulfil({ stdout, stderr });
        });
    });
}

export class Installer {
    constructor(
        private packages: PackageExtras,
        private mainPackage: PackageJson
    ) {}
    private packagesToInstall: PackageJson[] = [];

    private parseLua(text: string, packageInfos: PackageJson) {
        const regex = /LibStub(?:\:GetLibrary)?\("([^"]*)"/g;
        let result;
        while ((result = regex.exec(text)) !== null) {
            const referencePackageName = result[1];
            if (referencePackageName === packageInfos.lua.name) continue;
            const referencedPackage =
                this.packages.packageByLuaName.get(referencePackageName);
            if (referencedPackage) {
                if (
                    !referencedPackage.lua.parent &&
                    !this.isPackageIgnored(referencedPackage.name)
                )
                    packageInfos.dependencies[referencedPackage.name] = "*";
            } else {
                const moduleName = getModuleName(referencePackageName);
                try {
                    const packageExtra = this.packages.getExtras(moduleName);
                    this.packagesToInstall.push(packageExtra);
                    packageInfos.dependencies[moduleName] = "*";
                } catch (e) {
                    console.log(`Info: could not find module ${moduleName}`);
                }
            }
        }
        return text.replace(/\$Rev(ision)?\$/g, "99");
    }

    private async downloadSvnDirectory(
        moduleDir: string,
        path: string,
        client: WebDAVClient,
        packageInfo: PackageJson
    ) {
        if (!existsSync(join(moduleDir, path)))
            mkdirSync(join(moduleDir, path));
        try {
            const directoryItems = (await client.getDirectoryContents(
                path
            )) as FileStat[];
            for (const directoryItem of directoryItems) {
                if (directoryItem.type === "directory") {
                    await this.downloadSvnDirectory(
                        moduleDir,
                        directoryItem.filename,
                        client,
                        packageInfo
                    );
                } else if (directoryItem.type === "file") {
                    if (
                        directoryItem.basename.endsWith(".lua") ||
                        directoryItem.basename.endsWith(".xml")
                    ) {
                        try {
                            const buffer = (await client.getFileContents(
                                directoryItem.filename
                            )) as Buffer;
                            const outPath = join(
                                moduleDir,
                                directoryItem.filename
                            );
                            if (directoryItem.basename.endsWith(".lua")) {
                                const text = buffer.toString("utf8");
                                writeFileSync(
                                    outPath,
                                    this.parseLua(text, packageInfo)
                                );
                            } else {
                                writeFileSync(outPath, buffer);
                            }
                        } catch (error) {
                            console.log(error);
                        }
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    private async downloadSvn(
        moduleDir: string,
        url: string,
        packageInfo: PackageJson
    ) {
        console.log(url);
        const client = createClient(url);
        await this.downloadSvnDirectory(moduleDir, "/", client, packageInfo);
    }

    private clean(moduleDir: string, packageInfo: PackageJson): boolean {
        let hasContent = false;
        for (const entry of readdirSync(moduleDir, { withFileTypes: true })) {
            const path = join(moduleDir, entry.name);
            if (entry.isDirectory()) {
                hasContent = this.clean(path, packageInfo) || hasContent;
            } else if (
                entry.name.endsWith(".lua") ||
                entry.name.endsWith(".xml")
            ) {
                hasContent = true;
                if (entry.name.endsWith(".lua")) {
                    const content = readFileSync(path, { encoding: "utf8" });
                    const changed = this.parseLua(content, packageInfo);
                    if (changed !== content)
                        writeFileSync(path, changed, { encoding: "utf8" });
                }
            } else {
                unlinkSync(path);
            }
        }
        if (!hasContent) rmdirSync(moduleDir);
        return hasContent;
    }

    private async downloadGit(
        moduleDir: string,
        url: string,
        packageInfo: PackageJson
    ) {
        console.log(url);
        try {
            const emitter = degit(url.replace(/\.git$/, ""), {
                force: true,
                mode: "tar",
                verbose: true,
            });
            await emitter.clone(moduleDir);
        } catch (e) {
            await exec(`git clone ${url} ${moduleDir}`);
        }
        this.clean(moduleDir, packageInfo);
    }

    private downloadNpm(
        moduleDir: string,
        subModule: string,
        packageInfo: PackageJson
    ) {
        const module = packageInfo.name;
        if (!subModule) return;

        const outPath = join(moduleDir, subModule);
        const dirName = dirname(outPath);
        if (!existsSync(dirName)) mkdirSync(dirName, { recursive: true });
        let source = readFileSync(require.resolve(`${module}/${subModule}`), {
            encoding: "utf8",
        });
        if (subModule.endsWith(".xml")) {
            const regexp = RegExp('file="([^"]+)"', "g");
            let matches;
            while ((matches = regexp.exec(source)) !== null) {
                this.downloadNpm(
                    moduleDir,
                    join(dirname(subModule), matches[1]),
                    packageInfo
                );
            }
        } else if (subModule.endsWith(".lua")) {
            source = this.parseLua(source, packageInfo);
        }
        writeFileSync(outPath, source, { encoding: "utf8" });
    }

    private async downloadPackage(packageJson: PackageJson, libPath: string) {
        if (!packageJson.lua.name || !packageJson.lua.entry) {
            console.log(`No lua in package.json for ${module}`);
            return;
        }

        const moduleDir = join(
            libPath,
            packageJson.lua.parent ?? packageJson.lua.name
        );
        if (!existsSync(moduleDir)) {
            if (packageJson.lua.svn) {
                await this.downloadSvn(
                    moduleDir,
                    packageJson.lua.svn,
                    packageJson
                );
            } else if (packageJson.lua.git) {
                await this.downloadGit(
                    moduleDir,
                    packageJson.lua.git,
                    packageJson
                );
            } else {
                this.downloadNpm(moduleDir, packageJson.lua.entry, packageJson);
            }
        } else {
            this.clean(moduleDir, packageJson);
        }
    }

    private isPackageIgnored(packageName: string) {
        return (
            this.mainPackage.optionalDependencies &&
            this.mainPackage.optionalDependencies[packageName]
        );
    }

    canInstallPackage(x: PackageJson) {
        return !this.isPackageIgnored(x.name) && !x.lua.parent;
    }

    async install(outDir: string) {
        const libStub = {
            version: "0",
            name: "@wowts/lib-stub",
            lua: {
                entry: "LibStub.lua",
                svn: "https://repos.wowace.com/wow/libstub/trunk",
                name: "LibStub",
            },
            referencedBy: {},
            references: [],
            dependencies: {},
        };
        this.packages.extra.set(libStub.name, libStub);
        this.packages.packageByLuaName.set(libStub.lua.name, libStub);

        const libPath = join(outDir, "libs");
        if (!existsSync(libPath)) mkdirSync(libPath);

        this.packagesToInstall = Array.from(this.packages.extra.values());

        while (this.packagesToInstall.length > 0) {
            const packageJson = this.packagesToInstall.pop();
            if (packageJson === undefined) break;
            if (this.isPackageIgnored(packageJson.name)) continue;
            await this.downloadPackage(packageJson, libPath);
        }
        const packageEntries = Array.from(this.packages.extra.values()).filter(
            (x) => !this.isPackageIgnored(x.name)
        );

        const sources: PackageJson[] = [];
        for (const packageEntry of packageEntries) {
            if (!packageEntry.dependencies) {
                packageEntry.dependencies = {};
            }

            if (
                packageEntry.name !== "@wowts/lib-stub" &&
                !packageEntry.dependencies["@wowts/lib-stub"]
            ) {
                packageEntry.dependencies["@wowts/lib-stub"] = "*";
            }

            for (const module of Object.keys(packageEntry.dependencies)) {
                const reference = this.packages.extra.get(module);
                if (reference) {
                    packageEntry.references.push(reference);
                    reference.referencedBy[packageEntry.name] = packageEntry;
                }
            }
            if (packageEntry.references.length === 0)
                sources.push(packageEntry);
        }

        const sortedSources: PackageJson[] = [];
        while (sources.length > 0) {
            const source = sources.pop();
            if (!source) break;
            sortedSources.push(source);
            for (const reference of Object.values(source.referencedBy)) {
                reference.references.splice(
                    reference.references.indexOf(source),
                    1
                );
                if (reference.references.length == 0) {
                    sources.push(reference);
                }
            }
        }

        let hasErrors = false;
        for (const source of packageEntries) {
            if (source.lua.entry && source.lua.name) {
                const entryPath = join(
                    libPath,
                    source.lua.parent ?? source.lua.name,
                    source.lua.entry
                );
                if (!existsSync(entryPath)) {
                    console.log(
                        `Error: ${entryPath} does not exist in module ${source.name}`
                    );
                }
            }
            if (source.references.length > 0) {
                console.error(
                    `${
                        source.name
                    } has circular dependencies with ${source.references
                        .map((x) => x.name)
                        .join(",")}`
                );
                hasErrors = true;
            }
        }
        if (hasErrors) process.exit(1);

        const output = `<Ui xmlns="http://www.blizzard.com/wow/ui/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.blizzard.com/wow/ui/
..\FrameXML\UI.xsd">
${sortedSources
    .map((packageExtras) => getEntryInclude(packageExtras.lua))
    .join("\n")}
</Ui>
    `;
        const indexPath = join(libPath, "files.xml");

        writeFileSync(indexPath, output);

        const lua = this.mainPackage.lua;
        if (lua) {
            const toc = `## Interface: ${lua.interface}
## Title: ${lua.title}
## Notes: ${this.mainPackage.description}
## Author: ${this.mainPackage.author}
## Version: ${this.mainPackage.version}
## OptionalDeps: LibStub, ${Array.from(this.packages.extra.values())
                .map((x) => x.lua?.name)
                .join(", ")}
${lua.savedVariables ? `## SavedVariables: ${lua.savedVariables}` : ""}

libs\\files.xml
files.xml
`;

            writeFileSync(join(outDir, `${lua.name}.toc`), toc, {
                encoding: "utf8",
            });
        }
    }
}
