const express = require('express');

const router = express.Router();
const imageController = require('../../controllers/image.controller');

router.post('/', imageController.generateImageFromReqBody);
router.get('/', imageController.generateImageFromQueryString);
module.exports = router;
