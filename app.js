require('dotenv').config();

const config = require('config');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const gm = require('gm').subClass({ imageMagick: true });
const path = require('path');
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
    const files = await getMedia(path.resolve(
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
    return list.map(file => path.resolve(folder, file));
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
    const extname = path.extname(file);
    const noVideo = extname.includes('png') || extname.includes('jpg');
    if (noVideo) {
      await createResizedImage({
        file,
        size: maxSize,
        outputPath,
        dimensions: dimensions[i],
      })
    } else  {
      await createScreenshot({
        file,
        size: landscape ? `${maxSize.width}x?` : `?x${maxSize.height}`,
        outputPath,
        dimensions: dimensions[i],
      });
    }
  }
}

/**
 * create screenshot of given video
 * @param {object} options
 * @returns {Promise<void>}
 */
function createScreenshot(options) {
  return new Promise((resolve, reject) => {
    const { file, size, outputPath, count, } = options;
    const filename = getFilename(options);
    const config = {
      folder: outputPath,
      filename,
      size,
      count: count || 3,
    };
    ffmpeg(file)
      .on('error', err => reject(err))
      .on('filenames', filenames => console.log(`File(s) ${filenames.join(', ')} created.`))
      .on('end', () => resolve())
      .screenshots(config);
  });
}

/**
 * create resized image of given image
 * @param {object} options
 * @returns {Promise<void>}
 */
function createResizedImage(options) {
  return new Promise((resolve, reject) => {
    const { file, outputPath, } = options;
    const { width, height, } = options.size;
    const filename = getFilename(options);
    gm(file)
      .resize(width, height)
      .write(path.resolve(__dirname, outputPath, filename), err => {
        if (err) {
          reject(err);
        } else {
          console.log(`File ${filename} created.`);
          resolve();
        }
      });
  })
}

/**
 * get export name
 * @param {object} options
 * @returns {string}
 */
function getFilename(options) {
  const { file, } = options;
  const { width, height, key, } = options.dimensions;
  const basename = path.basename(file, path.extname(file));
  return key ? `${basename}_thumb_${key}.png` : `${basename}_thumb_${width}x${height}.png`;
}
