declare module "webdav" {
    export interface WebdavEntry {
        type: "file" | "directory";
        filename: string;
        basename: string;
    }
    export interface WebdavClient {
        getDirectoryContents(path: string): Promise<WebdavEntry[]>;
        getFileContents(path: string): Promise<Buffer>;
    }
    export function createClient(url: string): WebdavClient;
}
