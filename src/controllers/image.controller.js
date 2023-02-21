const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { createCanvas } = require('canvas');
const logger = require('../config/logger');
const fs = require('fs');
// Import the helper function.
const { formatTitle } = require('../utils/formatTitle');

const genImage = async () => {
  const width = 1200;
  const height = 627;
  const titleY = 170;
const lineHeight = 100;
const authorY = 500;

  // Add post object with the content to render
  const post = {
    title: 'This is the heading of the banner',
    author: 'Sean C Davis',
  };

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  context.fillStyle = '#764abc';
  context.fillRect(0, 0, width, height);

  // Set the style of the test and render it to the canvas
  context.font = "bold 70pt 'PT Sans'";
  context.textAlign = 'center';
  context.fillStyle = '#fff';

  // Format the title and render to the canvas.
  const text = formatTitle(post.title);

  // 600 is the x value (the center of the image)
  // 170 is the y (the top of the line of text)
  context.fillText(text[0], 600, titleY);

  // If we need a second line, we move use the titleY and lineHeight
  // to find the appropriate Y value.
  if (text[1]) context.fillText(text[1], 600, titleY + lineHeight);

  // Render the byline on the image, starting at 600px.
  context.font = "40pt 'PT Sans'";
  context.fillText(`by ${post.author}`, 600, authorY);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('./image.png', buffer);
};

const generateImage = catchAsync(async (req, res) => {
  try {
    // generate image
    const image_original = await genImage();
    res.status(httpStatus.NO_CONTENT).send({
      image_original,
    });
  } catch (error) {
    logger.error('Error generating image: ' + error.message);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR);
  }
});

module.exports = {
  generateImage,
};
