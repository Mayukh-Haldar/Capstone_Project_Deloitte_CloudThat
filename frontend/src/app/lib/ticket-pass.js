export const getDisplayQrDataUri = (dataUri) => {
    const prefix = "data:image/svg+xml;base64,";
    if (!dataUri.startsWith(prefix)) {
        return dataUri;
    }
    try {
        const encoded = dataUri.slice(prefix.length);
        const svg = window.atob(encoded);
        const parser = new DOMParser();
        const document = parser.parseFromString(svg, "image/svg+xml");
        const svgNodes = Array.from(document.querySelectorAll("svg"));
        const qrSvg = svgNodes.length > 1 ? svgNodes[1] : svgNodes[0];
        if (!qrSvg) {
            return dataUri;
        }
        const serializer = new XMLSerializer();
        const qrMarkup = serializer.serializeToString(qrSvg);
        return `${prefix}${window.btoa(qrMarkup)}`;
    }
    catch {
        return dataUri;
    }
};
