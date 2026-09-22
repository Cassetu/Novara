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
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${entry.title} - Novara</title>
            <meta name="description" content="${entry.description}">
            <meta property="og:title" content="${entry.title}">
            <meta property="og:description" content="${entry.description}">
            <meta property="og:url" content="https://novaraedu.org/curriculum/${entry.id}">
            <link rel="canonical" href="https://novaraedu.org/curriculum/${entry.id}">
            <link rel="stylesheet" href="/css/style.css">
            <link rel="stylesheet" href="/css/landing.css">
        </head>
        <body>
            <h1>${entry.title}</h1>
            <p>${entry.description}</p>
            <a href="/index.html?view=curriculum-home&id=${entry.id}">Start this curriculum</a>
        </body>
        </html>
    `;

    fs.writeFileSync(`${folderPath}/index.html`, html);
});