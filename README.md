# Fanbox Downloader

This script automates the downloading of images from Fanbox creators and sends notifications to a Discord webhook. It can also archive downloaded images and move them to a specified location where a webserver can serve them. The url for downloading the archive will be appended to the discord webhook message.

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Copy the example configuration file and configure it:**
   ```bash
   cp config.json.example config.json
   ```

3. **Edit `config.json` with your configuration:**
   ```json
   {
     "webhookUrl": "your_discord_webhook_url",
     "archiveBaseURL": "your_archive_base_url",
     "archiveBasePath": "your_archive_base_path",
     "imagesDir": "your_images_directory"
   }
   ```

4. **Copy the example creators file and configure it:**
   ```bash
   cp creators.json.example creators.json
   ```

5. **Edit `creators.json` to include the creators you want to download from (you can configure multiple creators):**
   ```json
   [
     {
       "name": "creator_name",
       "sessionId": "your_session_id",
       "url": "creator_url",
       "banner": "creator_banner_url",
       "logo": "creator_logo_url",
       "archive": true
     }
   ]
   ```

## Running the Script

Run the script using Node.js:
```bash
node app.js
```

For command-line arguments, see:
```bash
node app.js --help
```

## Command-Line Arguments

- `--force, -f`: Force download all files (appends `--all` to the download command).

Example:
```bash
node app.js --force
```