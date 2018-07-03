require('dotenv').config();

const config = require('config');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { resolve, extname } = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);

main()
  .then(() => console.log('finished!'))
  .catch(console.error);

/**
 * entry
 * @returns {Promise<void>}
 */
async function main() {
  try {
    console.log(resolve(__dirname, process.env.INPUT_PATH || config.inputPath));
    const files = await getMedia(resolve(
      __dirname,
      process.env.INPUT_PATH || config.inputPath
    ));
    for (let i = 0, len = files.length; i < len; i++) {
      const { width, height } = await getSize(files[i]);
      const { outputPath, dimensions } = config;
      await createThumbnails({
        file: files[i],
        outputPath: process.env.OUTPUT_PATH || outputPath,
        dimensions,
        width,
        height,
      });
    }
  } catch (err) {
    throw err;
  }
}

/**
 * get list of media from given folder
 * @param {string} folder
 * @returns {Promise<[]string>}
 */
async function getMedia(folder) {
  try {
    const list = await readdir(folder);
    return list.map(file => resolve(folder, file));
  } catch (err) {
    throw err;
  }
}

/**
 * get pixel size of given media
 * @param {string} file
 * @returns {Promise<object>}
 */
function getSize(file) {
  return new Promise((resolve, reject) => {
    ffmpeg(file)
      .ffprobe((err, data) => {
        if (err) {
          reject(err);
        } else {
          const { width, height, } = data.streams[0];
          resolve({ width, height, });
        }
      });
  });
}

/**
 * create thumbnails
 * @param {object} options
 * @returns {Promise<void>}
 */
async function createThumbnails(options) {
  const { file, width, height, outputPath, dimensions } = options;
  for (let i = 0, len = dimensions.length; i < len; i++) {
    const landscape = width > height;
    const baseValue = landscape ? 'width' : 'height';
    const maxSize = dimensions[i][baseValue] > options[baseValue]
      ? { width, height, }
      : dimensions[i];
    const size = landscape ? `${maxSize.width}x?` : `?x${maxSize.height}`;
    await createScreenshot({
      file,
      size,
      outputPath,
      dimensions: dimensions[i],
    });
  }
}

/**
 * create screenshot of given media
 * @param {object} options
 * @returns {Promise<void>}
 */
function createScreenshot(options) {
  return new Promise((resolve, reject) => {
    const { file, size, outputPath, count, } = options;
    const { width, height, key } = options.dimensions;
    const extname = extname(file);
    const noVideo = extname.includes('png') || extname.includes('jpg');
    const filename = key ? `%b_thumb_${key}.png` : `%b_thumb_${width}x${height}.png`;
    const baseConfig = {
      folder: outputPath,
      filename,
      size,
    };
    const config = Object.assign(
      {},
      baseConfig,
      noVideo ? { timestamps: ['00:00:000'], } : { count: count || 3, }
    );
    ffmpeg(file)
      .on('error', err => reject(err))
      .on('filenames', filenames => console.log(`File(s) ${filenames.join(', ')} created.`))
      .on('end', () => resolve())
      .screenshots(config);
  });
}
