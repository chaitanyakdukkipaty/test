const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const url = process.argv[2];
if (!url) {
  console.error('❌ Please provide a URL:\nExample: node download-images.js https://example.com');
  process.exit(1);
}

const { hostname } = new URL(url);
const baseName = hostname.replace(/^www\./, '').replace(/\./g, '-');
const OUTPUT_DIR = `./website-assets/${baseName}`;

(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: null, args: ['--start-maximized'] });
  const page = await browser.newPage();

  // Set to full HD resolution to ensure all content loads in a large viewport
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(url);

  // Scroll to bottom to trigger lazy-loaded content
  await autoScroll(page);

  // Wait for all images and background assets to load completely
  // await page.evaluate(async () => {
  //   const allElements = Array.from(document.querySelectorAll('img, *'));
  //   await Promise.all(
  //     allElements.map(el => {
  //       if (el.tagName.toLowerCase() === 'img') {
  //         return new Promise(resolve => {
  //           if (el.complete) return resolve();
  //           el.onload = el.onerror = resolve;
  //         });
  //       }
  //       const style = window.getComputedStyle(el);
  //       const bg = style.getPropertyValue('background-image');
  //       if (bg && bg.includes('url')) {
  //         const urlMatch = bg.match(/url\(("|')?(.*?)\1\)/);
  //         if (urlMatch) {
  //           const img = new Image();
  //           img.src = urlMatch[2];
  //           return new Promise(resolve => {
  //             img.onload = img.onerror = resolve;
  //           });
  //         }
  //       }
  //       return Promise.resolve();
  //     })
  //   );
  // });

  await fs.ensureDir(OUTPUT_DIR);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'full-page.png'), fullPage: true });

  const images = await page.evaluate(() => {
    const extractBgUrl = style => {
      const match = style.match(/url\(["']?(.*?)["']?\)/);
      return match ? match[1] : null;
    };

    const isDecorative = el => {
      const role = el.getAttribute('role');
      const ariaHidden = el.getAttribute('aria-hidden');
      return (
        role === 'presentation' ||
        ariaHidden === 'true'
      );
    };

    const imgElements = [...document.querySelectorAll('img')]
      .filter(img => !isDecorative(img))
      .map(img => {
        const srcset = img.getAttribute('srcset');
        let finalSrc = img.src;
        if (srcset) {
          const candidates = srcset.split(',').map(s => s.trim().split(' ')[0]);
          finalSrc = candidates[candidates.length - 1] || img.src;
        }
        if (finalSrc.startsWith('/')) {
          finalSrc = `${window.location.origin}${finalSrc}`;
        }
        return {
          type: 'img',
          src: finalSrc,
          alt: img.alt || 'no-alt-text'
        };
      });

    const bgElements = [...document.querySelectorAll('*')]
      .filter(el => {
        const style = window.getComputedStyle(el);
        const bg = style.getPropertyValue('background-image');
        return el.offsetWidth > 0 && el.offsetHeight > 0 && bg.includes('url') && !bg.includes('gradient');
      })
      .map(el => {
        const style = window.getComputedStyle(el);
        const bg = style.getPropertyValue('background-image');
        const url = extractBgUrl(bg);
        return url ? {
          type: 'bg',
          src: url,
          alt: 'background-image'
        } : null;
      }).filter(Boolean);

    return [...imgElements, ...bgElements];
  });

  const imageDir = path.join(OUTPUT_DIR, 'images');
  await fs.ensureDir(imageDir);
  const seenSrcs = new Set();
  const manifest = [];

  for (let [index, { src, alt, type }] of images.entries()) {
    if (seenSrcs.has(src)) {
      console.log(`⏭️ Skipping duplicate: ${src}`);
      continue;
    }

    seenSrcs.add(src);

    try {
      const imgResponse = await axios.get(src, { responseType: 'arraybuffer' });
      const ext = path.extname(new URL(src).pathname).split('?')[0] || '.jpg';
      const safeAlt = alt.replace(/[^\w\d-_]/g, '_').slice(0, 50) || `image${index}`;
      const fileName = `${seenSrcs.size}-${safeAlt}${ext}`;
      const filePath = path.join(imageDir, fileName);

      await fs.writeFile(filePath, imgResponse.data);
      manifest.push({ type, src, alt, filename: fileName });
      console.log(`✅ Downloaded: ${fileName}`);
    } catch (err) {
      console.warn(`⚠️ Failed to download ${src}:`, err.message);
    }
  }

  await fs.writeJson(path.join(OUTPUT_DIR, 'manifest.json'), manifest, { spaces: 2 });
  console.log('📦 Saved manifest.json');
  await browser.close();
})();

// Scroll function to ensure lazy-loaded elements are triggered
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
