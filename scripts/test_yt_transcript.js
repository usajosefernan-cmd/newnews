const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity'
};

async function getTranscript(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const resp = await fetch(url, { headers: BROWSER_HEADERS });
  const html = await resp.text();
  
  const idx = html.indexOf('"captionTracks"');
  if (idx === -1) {
    console.log('No captionTracks found in HTML');
    return null;
  }
  
  const startIdx = html.indexOf('[', idx);
  if (startIdx === -1) return null;
  
  let braceCount = 1;
  let endIdx = startIdx + 1;
  while (braceCount > 0 && endIdx < html.length) {
    const char = html[endIdx];
    if (char === '[') braceCount++;
    else if (char === ']') braceCount--;
    endIdx++;
  }
  
  const jsonStr = html.substring(startIdx, endIdx);
  
  try {
    const captionTracks = JSON.parse(jsonStr);
    if (!captionTracks || captionTracks.length === 0) {
      console.log('No caption tracks found in parsed array');
      return null;
    }
    
    // Priorizar español
    let track = captionTracks.find(t => t.languageCode === 'es');
    if (!track) track = captionTracks[0]; // fallback
    
    console.log('Caption Track URL:', track.baseUrl);
    
    // Fetch baseUrl
    const subResp = await fetch(track.baseUrl, { headers: BROWSER_HEADERS });
    const xml = await subResp.text();
    
    // Parsear XML de subtítulos rudimentariamente
    const textSegments = [];
    const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
    let m;
    while ((m = textRegex.exec(xml)) !== null) {
      textSegments.push(decodeHtml(m[1]));
    }
    
    return textSegments.join(' ');
  } catch (err) {
    console.error('Error parsing transcript:', err);
    return null;
  }
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;quot;/g, '"');
}

getTranscript('RIdWFv0Mv44').then(t => {
  console.log('\n--- Transcript ---');
  console.log(t ? t.substring(0, 1000) + '...' : 'Failed to retrieve transcript');
});
