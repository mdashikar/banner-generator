const express = require('express');

const router = express.Router();
const imageController = require('../../controllers/image.controller');

router.post('/', imageController.generateImageViaKonva);
router.get('/', imageController.generateImageViaKonva);
module.exports = router;
