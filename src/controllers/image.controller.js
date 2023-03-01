const { loadImage } = require('canvas');
const fs = require('fs');
const httpStatus = require('http-status');
const Konva = require('konva/cmj').default;
const QRCode = require('qrcode');

const logger = require('../config/logger');

const templateData = require('../../db/templates.json');

// Define a function to generate a QR code and draw it on a Konva.Image
async function generateQRCode(url) {
  // Generate the QR code as a data URL
  const qrCodeDataURL = await QRCode.toDataURL(url);

  // Load the image from the data URL
  const image = await loadImage(qrCodeDataURL);

  // Create a new Konva.Image object and set its image to the generated QR code image
  const qrCodeImage = new Konva.Image({
    image,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });

  return qrCodeImage;
}

const generateImageFromQueryString = async (req, res) => {
  try {
    const { data } = req.query;

    const formatQueryString = JSON.parse(data);

    const { content } = templateData;
    const stage = Konva.Node.create(content);
    const images = await stage.find('Image');
    for (const imageNode of images) {
      const imageURL = imageNode.getAttr('src');
      const img = await loadImage(imageURL);
      imageNode.setImage(img);
    }
    for (const key in formatQueryString) {
      const item = JSON.parse(JSON.stringify(formatQueryString[key]));
      const element = stage.findOne(`#${item.name}`);
      if (element && element.className === 'Text') {
        element.text(item.text);
        // Call `layer.batchDraw()` to redraw the layer
        // so the changes are reflected on the stage
        stage.findOne('Layer').batchDraw();
      }
      if (element && element.className === 'Image') {
        const img = await loadImage(item.image_url);
        element.image(img);
        stage.findOne('Layer').draw();
      }
    }

    const qrCodeImage = await generateQRCode('www.ashik.dev');
    // Create a new Konva.Layer object
    const layer = new Konva.Layer();

    // Add the image to the layer
    layer.add(qrCodeImage);
    // Add the QR code image to the stage
    stage.add(layer);

    stage.findOne('Layer').draw();

    const imageBase64String = stage.toDataURL();
    const base64ImageWithoutHeader = imageBase64String.split(';base64,').pop();
    fs.writeFileSync('files/konva.png', base64ImageWithoutHeader, { encoding: 'base64' });
    const buffer = Buffer.from(base64ImageWithoutHeader, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.end(buffer);
  } catch (error) {
    logger.error(`Error generating image via konva: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json(httpStatus['500']);
  }
};

const generateImageFromReqBody = async (req, res) => {
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
        element.image(img);
        stage.findOne('Layer').draw();
      }
    }
    stage.findOne('Layer').draw();

    const imageBase64String = stage.toDataURL();
    const base64ImageWithoutHeader = imageBase64String.split(';base64,').pop();
    fs.writeFileSync('files/konva.png', base64ImageWithoutHeader, { encoding: 'base64' });

    res.status(httpStatus.CREATED).send({
      imageUrl: 'http://localhost:3000/files/konva.png',
      imageOriginal: imageBase64String,
    });
  } catch (error) {
    logger.error(`Error generating image via konva: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json(httpStatus['500']);
  }
};

module.exports = {
  generateImageFromQueryString,
  generateImageFromReqBody,
};
