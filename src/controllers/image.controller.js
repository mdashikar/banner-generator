const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const httpStatus = require('http-status');
const Konva = require('konva/cmj').default;

const logger = require('../config/logger');
// Import the helper function.
const { formatTitle } = require('../utils/formatTitle');

const templateData = require('../../db/templates.json');

console.log(templateData);

const genImage = async (title, content, author, imageUrl, backgroundImageUrl) => {
  const width = 1200;
  const height = 627;
  const titleY = 120;
  const contentY = 280;
  const lineHeight = 100;
  const authorY = 575;

  // Set the coordinates for the image position.
  const imagePosition = {
    w: 120,
    h: 120,
    x: 80,
    y: 30,
  };

  // Add post object with the content to render
  const post = {
    title,
    author,
  };

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const loadBackgroundImage = await loadImage(backgroundImageUrl);
  context.drawImage(loadBackgroundImage, 0, 0, canvas.width, canvas.height);

  // Set the style of the test and render it to the canvas
  context.font = "bold 70pt 'PT Sans'";
  context.textAlign = 'center';
  context.fillStyle = '#fff';

  // Format the title and render to the canvas.
  const text = formatTitle(post.title);

  // 600 is the x value (the center of the image)
  context.fillText(text[0], 600, titleY);

  // If we need a second line, we move use the titleY and lineHeight
  // to find the appropriate Y value.
  if (text[1]) context.fillText(text[1], 600, titleY + lineHeight);

  context.font = "40pt 'PT Sans'";
  context.textAlign = 'center';
  context.fillText(content, 600, contentY);

  // Render the byline on the image, starting at 600px.
  context.font = "40pt 'PT Sans'";
  context.fillText(`Author: ${post.author}`, 600, authorY);

  // Load the logo file and then render it on the screen.
  const loadImageObj = await loadImage(imageUrl);
  const { w, h, x, y } = imagePosition;

  context.drawImage(loadImageObj, x, y, w, h);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('files/image.png', buffer);
  return buffer.toString('base64');
};

const generateImage = async (req, res) => {
  try {
    const { title, author, content, imageUrl, backgroundImageUrl } = req.body;

    // generate image
    const imageBase64 = await genImage(title, content, author, imageUrl, backgroundImageUrl);

    res.status(httpStatus.CREATED).send({
      imageUrl: 'http://localhost:3000/files/image.png',
      imageBase64,
    });
  } catch (error) {
    logger.error(`Error generating image: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json(httpStatus['500_MESSAGE']);
  }
};

const generateImageViaKonva = async (req, res) => {
  try {
    const { modifications } = req.body;
    const { content } = templateData;
    const stage = Konva.Node.create(content);
    const images = await stage.find('Image');
    for (const imageNode of images) {
      const imageURL = imageNode.getAttr('src');
      const img = await loadImage(imageURL);
      imageNode.setImage(img);
    }

    for (const item of modifications) {
      const element = stage.findOne(`#${item.name}`);
      if (element && element.className === 'Text') {
        element.text(item.text);
        // Call `layer.batchDraw()` to redraw the layer
        // so the changes are reflected on the stage
        stage.findOne('Layer').batchDraw();
      }
      if (element && element.className === 'Image') {
        const img = await loadImage(item.image_url);
        console.log('Image loaded', img);
        element.image(img);
        stage.findOne('Layer').draw();
      }
    }

    stage.findOne('Layer').draw();

    const imageBase64String = stage.toDataURL();
    const base64ImageWithoutHeader = imageBase64String.split(';base64,').pop();
    fs.writeFileSync('files/konva.png', base64ImageWithoutHeader, { encoding: 'base64' });
    const buffer = Buffer.from(base64ImageWithoutHeader, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.end(buffer);
    // res.status(httpStatus.CREATED).send({
    //   imageUrl: 'http://localhost:3000/files/konva.png',
    //   imageOriginal: imageBase64String,
    // });
  } catch (error) {
    logger.error(`Error generating image via konva: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json(httpStatus['500']);
  }
};

module.exports = {
  generateImage,
  generateImageViaKonva,
};
