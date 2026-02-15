import puppeteer from 'puppeteer'
import fs from 'fs'

async function debugEbay() {
  const browser = await puppeteer.launch({
    headless: false, // Set to false so we can see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const searchUrl = 'https://www.ebay.com/sch/i.html?_nkw=ford+f150+headlight&_ipg=50'
  console.log('Navigating to:', searchUrl)

  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })

  // Take a screenshot
  await page.screenshot({ path: '/tmp/ebay-screenshot.png', fullPage: true })
  console.log('Screenshot saved to /tmp/ebay-screenshot.png')

  // Get page title
  const title = await page.title()
  console.log('Page title:', title)

  // Try different selectors
  const selectors = [
    '.srp-results',
    '.s-item',
    'li.s-item',
    '[class*="s-item"]',
    '.srp-river-results',
    'ul.srp-results'
  ]

  for (const selector of selectors) {
    const count = await page.$$eval(selector, els => els.length)
    console.log(`${selector}: ${count} elements`)
  }

  // Get the HTML of the first few items
  const items = await page.evaluate(() => {
    const allItems = Array.from(document.querySelectorAll('.s-item'))
    return allItems.slice(0, 3).map(item => ({
      html: item.innerHTML.substring(0, 300),
      className: item.className
    }))
  })

  console.log('\nFirst 3 items:')
  items.forEach((item, i) => {
    console.log(`\nItem ${i}:`)
    console.log('Class:', item.className)
    console.log('HTML:', item.html)
  })

  // Save full HTML
  const html = await page.content()
  fs.writeFileSync('/tmp/ebay-puppeteer.html', html)
  console.log('\nFull HTML saved to /tmp/ebay-puppeteer.html')

  console.log('\nWaiting 10 seconds before closing...')
  await new Promise(resolve => setTimeout(resolve, 10000))

  await browser.close()
}

debugEbay().catch(console.error)
