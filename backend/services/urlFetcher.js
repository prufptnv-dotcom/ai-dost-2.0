async function fetchSafeUrl(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const text = await res.text();
        return { success: true, content: text, url: url, domain: new URL(url).hostname, title: 'Web Page' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = { fetchSafeUrl };
