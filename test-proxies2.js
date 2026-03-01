const url = 'https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=1mo&includePrePost=false';
const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${url}`,
    `https://cors.eu.org/${url}`,
    `https://proxy.cors.sh/${url}`, // requires api key usually
    url
];
(async () => {
    for (const u of proxies) {
        try {
            const r = await fetch(u, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
            console.log(u.substring(0, 30), 'STATUS:', r.status);
            if (!r.ok) continue;
            const txt = await r.text();
            try {
                const json = JSON.parse(txt);
                console.log('  SUCCESS:', json?.chart?.result?.[0]?.meta?.symbol);
            } catch (e) {
                console.log('  JSON ERROR:', e.message.substring(0, 50));
            }
        } catch (e) {
            console.log(u.substring(0, 30), 'FETCH ERROR:', e.message);
        }
    }
})();
