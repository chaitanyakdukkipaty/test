const fs = require('fs');
const path = require('path');

// Get arguments from the command line
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Please provide the folder name inside website-assets as an argument.');
    process.exit(1);
}

const folderName = args[0];
const groupSize = parseInt(args[1], 10) || 10; // Default group size is 10
const user = 'chaitanyakdukkipaty';
const repo = 'test';
const branch = 'refs/heads/main';
const basePath = `website-assets/${folderName}`;

const manifestPath = path.join(__dirname, 'website-assets', folderName, 'manifest.json');
const contextImagePath = path.join(__dirname, 'website-assets', folderName, 'full-page.png');

if (!fs.existsSync(manifestPath)) {
    console.error(`The manifest.json file does not exist in the folder ${folderName}.`);
    process.exit(1);
}

if (!fs.existsSync(contextImagePath)) {
    console.error(`The context image (full-page.png) does not exist in the folder ${folderName}.`);
    process.exit(1);
}

const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const groupedImages = [];
for (let i = 0; i < manifestData.length; i += groupSize) {
    groupedImages.push(manifestData.slice(i, i + groupSize));
}

groupedImages.forEach((group, groupIndex) => {
    const jsonData = {
        userId: "252",
        groupId: "223",
        images: group.map((entry, index) => {
            return {
                id: (groupIndex * groupSize + index + 1).toString(),
                baseImage: `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${basePath}/images/${entry.filename}`,
                contextImage: `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${basePath}/full-page.png`,
                altText: entry.alt || "no-alt-text"
            };
        }),
        webhookUrl: "https://webhook.site/ed056c8e-c4ad-4593-8047-5f38a9e67aeb"
    };

    const outputFilePath = path.join(__dirname, `${folderName}-data-group-${groupIndex + 1}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
    console.log(`JSON data for group ${groupIndex + 1} has been generated and saved to ${outputFilePath}`);
});