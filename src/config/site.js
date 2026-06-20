const injectedSiteUrl = typeof __SITE_URL__ === 'undefined' ? '' : __SITE_URL__;

export const SITE_URL = injectedSiteUrl;
