async function run() {
  const url = "https://www.youtube.com/shorts/RIdWFv0Mv44";
  console.log('Triggering verification local API for:', url);
  const resp = await fetch('http://localhost:4321/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, text: '' })
  });
  
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep partial line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line.trim());
          console.log(`[API LOG] ${parsed.message}`);
        } catch (e) {
          console.log(`[RAW LOG] ${line}`);
        }
      }
    }
  }
}
run().catch(console.error);
