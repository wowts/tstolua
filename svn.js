const { createClient } = require("webdav");

async function main(client, path) {
    const directoryItems = await client.getDirectoryContents(path);
    for (const directoryItem of directoryItems) {
        if (directoryItem.type === "directory") {
            main(client, directoryItem.filename);
        } else if (directoryItem.type === "file") {
            if (
                directoryItem.basename.endsWith(".lua") ||
                directoryItem.basename.endsWith(".xml")
            ) {
                console.log(directoryItem.filename);
            }
        }
    }
}

const client = createClient(
    "https://repos.wowace.com/wow/ace3/trunk/AceGUI-3.0"
);

main(client, "/");
