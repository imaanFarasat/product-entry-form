const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  description: { type: String, required: true },  // Add description field (you can make it optional if needed)
  Jewellery: { type: [String], required: true },  // Store image URLs in an array
  sizePriceData: { type: String, required: true }, // Store formatted size and price data as a string
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
