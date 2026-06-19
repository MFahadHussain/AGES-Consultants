const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_LOGO = path.join(__dirname, '../AGES-Logo-1.png');
const PUBLIC_DIR = path.join(__dirname, '../public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

async function processImages() {
  console.log('Starting image processing...');
  
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error(`Source logo not found at: ${SOURCE_LOGO}`);
    process.exit(1);
  }

  // Ensure directories exist
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  try {
    // 1. Copy/optimize main logo
    console.log('Optimizing main logo...');
    await sharp(SOURCE_LOGO)
      .png()
      .toFile(path.join(IMAGES_DIR, 'ages-logo.png'));
    console.log('✓ Created public/images/ages-logo.png');

    // 2. Favicon 16x16
    console.log('Generating favicon-16.png...');
    await sharp(SOURCE_LOGO)
      .resize(16, 16, { fit: 'contain', background: 'rgba(0,0,0,0)' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon-16.png'));
    console.log('✓ Created public/favicon-16.png');

    // 3. Favicon 32x32
    console.log('Generating favicon-32.png...');
    await sharp(SOURCE_LOGO)
      .resize(32, 32, { fit: 'contain', background: 'rgba(0,0,0,0)' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon-32.png'));
    console.log('✓ Created public/favicon-32.png');

    // 4. Apple Touch Icon 180x180
    console.log('Generating apple-touch-icon.png...');
    await sharp(SOURCE_LOGO)
      .resize(180, 180, { fit: 'contain', background: 'rgba(0,0,0,0)' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
    console.log('✓ Created public/apple-touch-icon.png');

    // 5. Favicon.ico (32x32 png)
    console.log('Generating favicon.ico (as 32x32 png)...');
    await sharp(SOURCE_LOGO)
      .resize(32, 32, { fit: 'contain', background: 'rgba(0,0,0,0)' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon.ico'));
    console.log('✓ Created public/favicon.ico');

    // 6. OG Image 1200x630 (Logo padded on white background)
    console.log('Generating og-image.png...');
    const logoResized = await sharp(SOURCE_LOGO)
      .resize(500, 260, { fit: 'contain', background: 'rgba(255,255,255,0)' })
      .toBuffer();

    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: '#ffffff'
      }
    })
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
    console.log('✓ Created public/og-image.png');

    console.log('Image processing completed successfully!');
  } catch (error) {
    console.error('Error processing images:', error);
    process.exit(1);
  }
}

processImages();
