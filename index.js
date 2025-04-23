
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.static("public"));

// Proxy endpoint
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  
  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    });

    // Copy status
    res.status(response.status);

    // Copy headers
    for (const [key, value] of response.headers) {
      // Skip headers that might interfere with our proxy
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.set(key, value);
      }
    }

    // Set security and CORS headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors 'self' *"
    });
    
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    
    // Handle all content types appropriately
    const isHtml = contentType.includes('html') || contentType === '';
    if (isHtml) {
      // Modify URLs to work through our proxy
      const baseUrl = new URL(fullUrl).origin;
      const modifiedHtml = text.replace(
        /(href|src|action|data-src)=["']([^"']+)["']/g,
        (match, attr, url) => {
          if (!url || url.startsWith('javascript:') || url.startsWith('#')) {
            return match;
          }
          if (url.startsWith('//')) {
            return `${attr}="${proxyBase}${encodeURIComponent('https:' + url)}"`;
          }
          if (url.startsWith('http')) {
            return `${attr}="${proxyBase}${encodeURIComponent(url)}"`;
          }
          if (url.startsWith('/')) {
            return `${attr}="${proxyBase}${encodeURIComponent(baseUrl + url)}"`;
          }
          return `${attr}="${proxyBase}${encodeURIComponent(baseUrl + '/' + url)}"`;
        }
      );
      res.send(modifiedHtml);
    } else {
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send(`Failed to fetch: ${error.message}`);
  }
});

const proxyBase = "/proxy?url=";

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
