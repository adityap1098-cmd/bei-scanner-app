const url = 'https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=6mo&includePrePost=false';
const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.io/fetch/${url}`,
    `https://api.codetabs.com/v1/proxy/?quest=${url}`,
    url
];
(async () => {
    for (const u of proxies) {
        try {
            const r = await fetch(u, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
            const status = r.status;
            if (!r.ok) {
                console.log('FAILED (not ok) for', u, status);
                continue;
            }
            const txt = await r.text();
            try {
                const json = JSON.parse(txt);
                console.log('SUCCESS for', u, json?.chart?.result?.[0]?.meta?.symbol);
            } catch (e) {
                console.log('FAILED (json parse) for', u, e.message);
            }
        } catch (e) {
            console.log('ERROR for', u, e.message);
        }
    }
})();
