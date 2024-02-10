const puppeteer = require('puppeteer');
const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/website-to-pdf', async (req, res) => {
  const url = req.query.url;
  const screenSize = req.query.screenSize || 'desktop';
  const pdfSize = req.query.pdfSize || 'portrait' || 'landscape';
  const pageSize = req.query.pageSize || 'nomargin' || 'smallmargin' || 'bigmargin';

 
  if (!url) {
    return res.render('website-to-pdf', { error: 'Please provide a URL to convert.' });
  }

  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const viewportSizes = {
      'mobile': { width: 375, height: 667 },
      'tablet': { width: 768, height: 1024 },
      'desktop': { width: 1440, height: 900 },
      'desktopHD': { width: 1920, height: 1080 },
      'laptop': { width: 1300, height: 768 },
    };

    const selectedViewport = viewportSizes[screenSize] || viewportSizes['desktop'];

    await page.setViewport({
      width: selectedViewport.width,
      height: selectedViewport.height,
      deviceScaleFactor: 1,
      hasTouch: false,
    });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for any asynchronous content to load
    await page.waitForTimeout(3000); // Adjust the wait time as needed

    // Remove Google Ads or adsbygoogle elements
    await page.evaluate(() => {
      const adsbygoogleElements = document.querySelectorAll('.adsbygoogle');
      adsbygoogleElements.forEach((element) => {
        element.remove();
      });
    });

    const filename = path.basename(url).replace(/\./g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

   

    const pdfSizes = {
      'portrait': { 
        width: viewportSizes[screenSize].width,
        height: viewportSizes[screenSize].height,
      },
      'landscape': { 
        width: viewportSizes[screenSize].height,
        height: viewportSizes[screenSize].width,
      },
    };
    

    const pageSizes = {
      'nomargin': { margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' } },
      'smallmargin': { margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' } },
      'bigmargin': { margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } },
    };

  
    const pdfOptions = {
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
      printBackground: true,
      ...pdfSizes[pdfSize],
      ...pageSizes[pageSize],
    };
      

    const pdfBuffer = await page.pdf(pdfOptions);

    res.send(pdfBuffer);

    await browser.close();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while converting the webpage to PDF.');
  }
});

module.exports = router;
