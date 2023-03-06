// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)

require('@tensorflow/tfjs-node');

const faceapi = require('@vladmandic/face-api');
const path = require('path');

const projectRoot = path.resolve(process.cwd());

const modelsPath = path.join(projectRoot, './weights');

const { loadImage, createCanvas, Canvas, Image, ImageData } = require('canvas');
const fs = require('fs');
const httpStatus = require('http-status');
const Konva = require('konva/cmj').default;
const QRCode = require('qrcode');
const sharp = require('sharp');
const smartcrop = require('smartcrop-sharp');

const logger = require('../config/logger');

const templateData = require('../../db/template_3.json');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Define a function to generate a QR code and draw it on a Konva.Image
const generateQRCode = async (url) => {
  // Generate the QR code as a data URL
  const qrCodeDataURL = await QRCode.toDataURL(url, {
    quality: 1,
    margin: 0,
    color: {
      dark: '#00F', // Blue dots
      light: '#0000', // Transparent background
    },
  });

  // Load the image from the data URL
  const image = await loadImage(qrCodeDataURL);

  // Create a new Konva.Image object and set its image to the generated QR code image
  const qrCodeImage = new Konva.Image({
    image,
    x: 0,
    y: 120,
    width: 100,
    height: 100,
  });

  return qrCodeImage;
};

// finds the best crop of src and writes the cropped and resized image to dest.
const applySmartCrop = async (src, width, height) => {
  // Load the buffer as an image object
  const img = await loadImage(src);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);

  // Detect faces in the image
  const detections = await faceapi.detectAllFaces(img);

  // Crop the image based on the first detected face
  if (detections.length > 0) {
    const detection = detections[0];

    const { x } = detection.box;
    const { y } = detection.box;
    const w = detection.box.width;
    const h = detection.box.height;
    const boost = [
      {
        x,
        y,
        width: w,
        height: h,
        weight: 1, // in the range [0, 1]
      },
    ];

    // Crop the image using smart crop
    return smartcrop.crop(src, { width: w, height: h, minScale: 1, ruleOfThirds: false, boost }).then(function (result) {
      const crop = result.topCrop;
      return sharp(src)
        .extract({ width: crop.width, height: crop.height, left: crop.x, top: crop.y })
        .resize(width, height)
        .toBuffer();
    });
  }

  return smartcrop.crop(src, { width, height }).then(function (result) {
    const crop = result.topCrop;
    return sharp(src)
      .extract({ width: crop.width, height: crop.height, left: crop.x, top: crop.y })
      .resize(width, height)
      .toBuffer();
  });
};

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
        element.text(item.value);
        // Call `layer.batchDraw()` to redraw the layer
        // so the changes are reflected on the stage
        stage.findOne('Layer').batchDraw();
      }
      if (element && element.className === 'Image') {
        const imgAttributes = element.attrs;
        const img = await loadImage(item.image_url);
        // // Create a canvas with the same dimensions as the image
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0, img.width, img.height);
        // Get the buffer from the canvas
        const buffer = canvas.toBuffer('image/png', { quality: 1 });

        // const imgBuffer = Buffer.from(img);
        const croppedImgBuffer = await applySmartCrop(buffer, parseInt(imgAttributes.width), parseInt(imgAttributes.height));
        const croppedImg = await loadImage(croppedImgBuffer);
        element.image(croppedImg);
        stage.findOne('Layer').draw();
      }
      if (element && element.attrs.type === 'rating') {
        const layer = new Konva.Layer();
        console.log(element.attrs.x);
        const ratingGroup = new Konva.Group();

        const star = new Konva.Star({
          x: element.children[0].attrs.x,
          y: element.children[0].attrs.y,
          numPoints: 6,
          innerRadius: 40,
          outerRadius: 70,
          fill: 'yellow',
          stroke: 'black',
          strokeWidth: 4,
        });
        console.log('Group children length -> ', element.children.length);

        for (let i = 0; i < element.children.length; i++) {
          const star = new Konva.Star(element.children[i].attrs);

          console.log('adding star to your group', element.children[i].attrs.x);
          ratingGroup.add(star);
        }
        console.log('ratingGroup added to layer');
        layer.add(ratingGroup);
        stage.add(layer);
        stage.findOne('Layer').draw();
      }
    }

    // const qrCodeImage = await generateQRCode('www.ashik.dev');
    // // Create a new Konva.Layer object
    // const layer = new Konva.Layer();

    // // Add the image to the layer
    // layer.add(qrCodeImage);
    // // Add the QR code image to the stage
    // stage.add(layer);

    stage.findOne('Layer').draw();

    const imageBase64String = stage.toDataURL();
    const base64ImageWithoutHeader = imageBase64String.split(';base64,').pop();
    fs.writeFileSync('files/konva.png', base64ImageWithoutHeader, { encoding: 'base64' });
    const buffer = Buffer.from(base64ImageWithoutHeader, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.end(buffer);
  } catch (error) {
    logger.error(`Error generating image via konva: ${error}`);
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
