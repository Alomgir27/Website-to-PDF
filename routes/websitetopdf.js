const puppeteer = require('puppeteer');
const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/website-to-pdf', async (req, res) => {
  const url = req.query.url;
  const screenSize = req.query.screenSize || 'desktop';
  const pdfSize = req.query.pdfSize || 'portrait' || 'landscape';
  const pageSize = req.query.pageSize || 'nomargin' || 'smallmargin' || 'bigmargin';

  console.log('all query params', req.query);

 
  if (!url) {
    return res.render('website-to-pdf', { error: 'Please provide a URL to convert.' });
  }

  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    

    const viewportSizes = {
      'mobile': { width: 375, height: 812 },
      'tablet': { width: 768, height: 1024 },
      'desktop': { width: 1440, height: 1600 },
      'desktopHD': { width: 1920, height: 2048 },
      'laptop': { width: 1300, height: 1400 },
      'A4': { width: parseInt(8.27 * 96), height: parseInt(11.69 * 96) },
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
    res.setHeader('Content-Disposition', `attachment; filename=${filename + '-' + screenSize + '-' + pdfSize + '-' + pageSize}.pdf`);

  

    const pageSizes = {
      'nomargin': { margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' } },
      'smallmargin': { margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' } },
      'bigmargin': { margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } },
    };

  
    const pdfOptions = {
      width: viewportSizes[screenSize].width,
      height: viewportSizes[screenSize].height,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
      printBackground: true,
      landscape: pdfSize === 'landscape',
      ...pageSizes[pageSize],
    };
    console.log(pdfOptions);

    const pdfBuffer = await page.pdf(pdfOptions);

    res.send(pdfBuffer);

    await browser.close();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while converting the webpage to PDF.');
  }
});





module.exports = router;
