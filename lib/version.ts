import { version } from '../package.json';

export const APP_VERSION = version;
export const APP_RELEASE_URL = `https://github.com/MoinPDF/moinpdf/releases/tag/v${encodeURIComponent(APP_VERSION)}`;
