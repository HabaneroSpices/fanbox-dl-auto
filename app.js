const fs = require('fs')
const path = require('path')
const winston = require('winston')
const {execSync} = require('child_process')
const {Webhook, MessageBuilder} = require('discord-webhook-node')
const archiver = require('archiver')
const crypto = require("crypto")
const yargs = require('yargs')


// Read package.json to get script name and version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scriptName = packageJson.name;
const scriptVersion = packageJson.version;

// Read config.json to get the configurable values
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { webhookUrl, archiveBaseURL, archiveBasePath, imagesDir } = config;

// Parse command-line arguments
const argv = yargs
    .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Force download all files',
    })
    .help()
    .alias('help', 'h')
    .argv;


// Create a logger with both console and file transports
const logger = winston.createLogger({
    format: winston.format.combine(winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}), winston.format.printf((info) => `${scriptName} ${info.timestamp} ${info.level}: ${info.message}`)),
    transports: [new winston.transports.Console(), new winston.transports.File({filename: 'download.log'})]
})

// Read the JSON file
const jsonData = fs.readFileSync('creators.json')
const data = JSON.parse(jsonData)

// Discord webhook URL
const webhook = new Webhook(webhookUrl)

webhook.setUsername('Fanbox-dl-auto')
webhook.setAvatar('https://avatars.githubusercontent.com/u/17667652?v=4')

// Function to create directory if it doesn't exist
const createDirectory = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
}

// Function to get list of files in a directory
const getFilesInDir = (dir) => fs.readdirSync(dir)

// Function to compare two arrays of files and return new files
const getNewFiles = (oldFiles, newFiles) => newFiles.filter((file) => !oldFiles.includes(file))

// Function to create an archive of new files
const createArchive = (files, sourceDir, outputFile) => {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputFile);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        files.forEach((file) => {
            const filePath = path.join(sourceDir, file);
            archive.file(filePath, { name: file });
        });
        archive.finalize();
    });
};

  ////////////////////////////////
 //            MAIN            //
////////////////////////////////

// Iterate over each entry in the JSON file
data.forEach(async (entry) => {
    const {name, sessionId, url, banner, logo, archive: shouldArchive} = entry

    // Set save directory to __dirname/images/
    const saveDir = imagesDir ? imagesDir : path.join(__dirname, 'images')

    // Create directory if it doesn't exist
    createDirectory(path.join(saveDir, name))

    // Get list of files before running fanbox-dl
    const oldFiles = getFilesInDir(path.join(saveDir, name))

    // Construct the fanbox-dl command
    let command = `./fanbox-dl --skip-files --sessid ${sessionId} --creator ${name} --save-dir "${saveDir}"`

    // Append --all if --force is provided
    if (argv.force) {
        command += ' --all';
    }

    // Execute the fanbox-dl command
    try {
        logger.info(`Downloading images for ${name}...`)
        execSync(command, {stdio: 'inherit'});

        // Get list of files after running fanbox-dl
        const newFiles = getFilesInDir(path.join(saveDir, name))

        // Check for new files
        const newImages = getNewFiles(oldFiles, newFiles)

        // Send Discord notification if new images were downloaded
        if (newImages.length > 0) {
            logger.info(`Images for ${name} downloaded successfully!`) // \n${newImages.join('\n')}

            const newImagesStringLimit = 15
            let newImagesString = newImages.slice(-newImagesStringLimit).join('\n')

            if (newImages.length > newImagesStringLimit) {
                const remainingImagesCount = newImages.length - newImagesStringLimit
                newImagesString += `\n+${remainingImagesCount} more...`
            }

            const successMessage = new MessageBuilder()
                .setTitle('New Fanbox Images')
                .setDescription(`from ${name} downloaded successfully!`)
                .setAuthor(name, logo, url)
                .addField('Overview', `\`\`\`\n${newImagesString}\`\`\``)
                .setImage(banner)
                .setColor('#a600ff')
                .setTimestamp()
                .setFooter(`${scriptName} v${scriptVersion}`)

            if (shouldArchive) {
                // Get random UUID for file archives
                const uuid = crypto.randomUUID();

                const archiveName = `${name}_new_images-${uuid}.zip`
                const tempArchivePath = path.join('/tmp', archiveName)

                const finalArchivePath = path.join(archiveBasePath, archiveName)
                const finalArchiveURL = path.join(archiveBaseURL, archiveName)

                logger.info(`Creating archive for for ${name}...`)
                await createArchive(newImages, path.join(saveDir, name), tempArchivePath)
                fs.renameSync(tempArchivePath, finalArchivePath);  // Move the archive to the final destination
                logger.info(`Archive for ${name} created successfully! -> ${finalArchivePath}`)

                successMessage.addField('Download latest file(s)', `[Archive (zip)](${finalArchiveURL})`)
            }
            await webhook.send(successMessage)
        } else {
            logger.info(`No new images downloaded for ${name}.`)
        }
    } catch (error) {
        logger.error(`Error downloading images for ${name}: ${error.message}`)

        // Send error notification to Discord
        const errorMessage = new MessageBuilder()
            .setTitle('Download Error')
            .setDescription(`when downloading images from ${name}`)
            .addField('Overview', `\`\`\`\n${error.message}\`\`\``)
            .setColor('#ff0000') // Red color
            .setTimestamp()
            .setFooter(`${scriptName} v${scriptVersion}`)

        await webhook.send(errorMessage)
    }
});
