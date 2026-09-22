import fs from "fs";

const catalogData = JSON.parse(fs.readFileSync("data/catalog.json", "utf-8"));

if (!fs.existsSync("curriculum")) {
    fs.mkdirSync("curriculum");
}

catalogData.forEach(entry => {
    const folderPath = `curriculum/${entry.id}`;
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
});