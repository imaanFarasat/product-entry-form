const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');
const aws = require('aws-sdk');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Image = require('./models/image'); // Import the Image model
const { OpenAI } = require('openai'); // Import OpenAI package

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '..', 'deployment', '.env') });

// AWS S3 configuration
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Your AWS Access Key
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Your AWS Secret Key
  region: process.env.AWS_REGION, // Your AWS Region
});

// Multer configuration for handling file uploads in memory
const storage = multer.memoryStorage(); // Store files in memory before uploading to S3
const upload = multer({ storage: storage });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve static files from 'public' folder

// MongoDB connection setup
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// OpenAI API setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure you have set the OpenAI API key in your .env file
});


// Function to generate a description using OpenAI with custom input integrated
async function generateDescription(productName, userDescription, sizes = [], prices = []) {
  try {
    // Log the userDescription and input sizes/prices to make sure they're being passed correctly
    console.log('User Description:', userDescription);
    console.log('Sizes:', sizes);
    console.log('Prices:', prices);

    // Prepare sizes and prices for the prompt
    let sizeString = sizes.length > 0 ? `Available sizes: ${sizes.join(', ')}` : '';
    let priceString = prices.length > 0 ? `Prices: ${prices.map(price => `${price}$ CAD`).join(', ')}` : '';

    // Combine the size and price information for the description
    let additionalInfo = '';
    if (sizeString && priceString) {
      additionalInfo = `${sizeString}. ${priceString}.`;
    } else if (sizeString) {
      additionalInfo = `${sizeString}.`;
    } else if (priceString) {
      additionalInfo = `${priceString}.`;
    }

    const requestPayload = {
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: 'You are an assistant that generates simple and creative product descriptions using custom input. Always use simple words to describe the product, and ensure the description starts with "Shop our" and ends with a call to action and relevant Instagram hashtags.'
      }, {
        role: 'user',
        content: `Generate a detailed product description for: ${productName}. Use this custom description as inspiration: "${userDescription}". Include the following details: ${additionalInfo}.`
      }]
    };

    // Log the entire API request payload to verify that everything is included
    console.log('API Request Payload:', requestPayload);

    const response = await openai.chat.completions.create(requestPayload);

    // Log the response from OpenAI to verify that the description is generated correctly
    console.log('OpenAI Response:', response);

    let description = response.choices[0].message.content;

    // Ensure the description starts with "Shop our"
    if (!description.startsWith('Shop our')) {
      description = 'Shop our ' + description;
    }

    // Add "Visit rezagemcollection.shop where you can find all our products" before hashtags
    description += `\n\nVisit rezagemcollection.shop where you can find all our products.\n\n`;

    // Now request the AI to generate relevant Instagram hashtags based on the product name
    const hashtagsResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: 'You are an assistant that generates relevant Instagram hashtags for a product name.'
      }, {
        role: 'user',
        content: `Generate 15 relevant Instagram hashtags for the product: ${productName}.`
      }]
    });

    const hashtags = hashtagsResponse.choices[0].message.content.split('\n').map(tag => tag.trim()).filter(tag => tag.length > 0);

    // Ensure we have exactly 15 hashtags
    if (hashtags.length > 15) {
      hashtags.length = 15;
    }

    // Add hashtags at the end
    description += hashtags.join(' ');

    // Return the final description
    return description;

  } catch (error) {
    console.error('Error generating description with OpenAI:', error);
    throw new Error('Failed to generate product description');
  }
}





// Function to add watermark to an image
async function addWatermarkAndSave(imageBuffer, watermarkText) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const svgFilePath = path.join(__dirname, 'no.svg'); // Path to watermark SVG
    const svgBuffer = fs.readFileSync(svgFilePath);

    let svgString = svgBuffer.toString();
    svgString = svgString.replace('{{PRODUCT_NAME}}', watermarkText);

    const positionBottom = metadata.height - (2 * 96);
    const positionLeft = metadata.width / 2;

    const updatedSvgString = svgString.replace(
      '</svg>',
      `<text x="${positionLeft}" y="${positionBottom}" font-family="NotoSerifDisplay" font-weight="bold" font-size="120" fill="white" text-anchor="middle">
        ${watermarkText}
      </text>
      </svg>`
    );

    const finalSvgBuffer = Buffer.from(updatedSvgString);

    const resizedSvgBuffer = await sharp(finalSvgBuffer)
      .resize(metadata.width, metadata.height)
      .toBuffer();

    const watermarkedImageBuffer = await image
      .composite([{ input: resizedSvgBuffer, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();

    return watermarkedImageBuffer;
  } catch (error) {
    console.error('Error processing image:', error.message);
    throw error;
  }
}

// Serve the index.html page for file upload form at /reza path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API route to upload images to S3 and save URLs in MongoDB
app.post('/api/images/upload', upload.array('images', 10), async (req, res) => {
  try {
    const { productName, userDescription } = req.body; // Extract both product name and user description

    // Validate input
    if (!productName || !userDescription || !req.files || req.files.length === 0) {
      console.error('Validation error: Missing product name, user description, or files.');
      return res.status(400).json({ error: 'Product name, user description, and at least one image are required.' });
  }

    // Generate description using OpenAI
    let productDescription;
    try {
      productDescription = await generateDescription(productName, userDescription);
      console.log('Generated Description:', productDescription);
    } catch (error) {
      console.error('Error generating description:', error);
      return res.status(500).json({ error: 'Failed to generate product description.' });
    }

    // Upload each file to S3 after adding watermark
    const uploadPromises = req.files.map(async (file) => {
      // Add watermark to the image
      const watermarkedBuffer = await addWatermarkAndSave(file.buffer, productName);

      // Prepare S3 upload parameters
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME, // Your S3 bucket name
        Key: `products/${Date.now()}-${file.originalname}`, // Folder and unique file name
        Body: watermarkedBuffer, // File data with watermark
        ContentType: file.mimetype, // File type
      };

      // Upload to S3
      return s3.upload(params).promise().catch((err) => {
        console.error(`Error uploading file '${file.originalname}' to S3:`, err);
        throw new Error(`S3 upload failed for '${file.originalname}'.`);
      });
    });

    let s3Results;
    try {
      s3Results = await Promise.all(uploadPromises); // Wait for all uploads to complete
    } catch (uploadError) {
      console.error('Error during S3 upload process:', uploadError);
      return res.status(500).json({ error: 'S3 upload failed. Check server logs for details.' });
    }

    const imageUrls = s3Results.map((result) => result.Location); // Extract the file URLs from S3 responses
    console.log('S3 upload successful. Image URLs:', imageUrls);

    // Find the document by product name or create a new one
    let updatedProduct;
    try {
      updatedProduct = await Image.findOneAndUpdate(
        { productName }, // Search by product name
        { 
          $push: { Jewellery: { $each: imageUrls } }, // Add URLs to the Jewellery field (array)
          description: productDescription, // Save the generated description
        },
        { new: true, upsert: true } // Create a new document if not found
      );
    } catch (dbError) {
      console.error('Error updating MongoDB:', dbError);
      return res.status(500).json({ error: 'Failed to save image URLs and description to the database.' });
    }

    console.log('MongoDB update successful. Updated product:', updatedProduct);

    res.status(201).json({
      message: 'Images uploaded, description generated, and saved successfully!',
      product: updatedProduct, // Return the updated product data to the client
    });
  } catch (err) {
    console.error('Unexpected error in /api/images/upload:', err);
    res.status(500).json({ error: 'Failed to upload and save images. Check server logs for details.' });
  }
});

// API route to fetch all images and description for a product
app.get('/api/images/:productName', async (req, res) => {
  try {
    const { productName } = req.params; // Get product name from the URL
    const product = await Image.findOne({ productName: productName }); // Fetch product from the DB
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product); // Send product data including images and description
  } catch (err) {
    console.error('Error fetching images and description:', err);
    res.status(500).json({ error: 'Failed to fetch images and description' });
  }
});

// Start the server
app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
