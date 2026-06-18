const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the financial year page
  await page.goto('http://localhost:3000/planning/financial-year');
  
  // Wait for the button to appear
  await page.waitForSelector('button:has-text("New Year")');
  
  // Try to click the button and catch any errors (e.g. intercepted)
  try {
    await page.click('button:has-text("New Year")', { timeout: 3000 });
    console.log("Successfully clicked 'New Year'");
  } catch (err) {
    console.error("Click failed. Error:", err.message);
    
    // Evaluate pointer-events and z-index of the button
    const styles = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Year'));
      if (!btn) return null;
      const comp = window.getComputedStyle(btn);
      return { pointerEvents: comp.pointerEvents, disabled: btn.disabled };
    });
    console.log("Button styles:", styles);
    
    // Find what element is at the center of the button (the one intercepting)
    const interceptor = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Year'));
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return el ? { tagName: el.tagName, className: el.className, id: el.id, html: el.outerHTML.substring(0, 200) } : null;
    });
    console.log("Element at click coordinates:", interceptor);
  }
  
  // Check body pointer-events
  const bodyStyles = await page.evaluate(() => {
    return { pointerEvents: window.getComputedStyle(document.body).pointerEvents };
  });
  console.log("Body styles:", bodyStyles);

  await browser.close();
})();
