/**
 * Lightweight HTML sanitizer using browser DOMParser to prevent XSS.
 * Strips script/iframe/object tags, event handlers (onclick/onerror), and javascript: URLs.
 */
export const sanitizeHtml = (dirtyHtml: string): string => {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirtyHtml, 'text/html');

        // Remove dangerous/executable elements
        const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link', 'style', 'applet'];
        forbiddenTags.forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });

        // Strip dangerous attributes (inline event handlers and javascript: href/src)
        const allElements = doc.querySelectorAll('*');
        allElements.forEach(el => {
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                const name = attr.name.toLowerCase();
                const val = (attr.value || '').trim().toLowerCase();
                if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return doc.body.innerHTML;
    } catch {
        return '';
    }
};
