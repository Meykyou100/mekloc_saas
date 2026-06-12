import { useEffect } from 'react';
import { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, DEFAULT_LOGO, DEFAULT_OG_IMAGE, DEFAULT_TITLE, SITE_NAME, SITE_URL, absoluteUrl } from '../../config/seo';
import { MEKLOC_PLANS } from '../../config/pricing';
import { SUPPORT_EMAIL } from '../../config/app';

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

type SEOProps = {
  title?: string;
  description?: string;
  canonical?: string;
  keywords?: string[];
  image?: string;
  noindex?: boolean;
  jsonLd?: JsonLd;
};

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function baseStructuredData() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      email: SUPPORT_EMAIL,
      logo: DEFAULT_LOGO,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: 'SaaS de gestion pour agences de location de voitures au Maroc',
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter',
          price: MEKLOC_PLANS.starter.monthlyPrice,
          priceCurrency: 'MAD',
          category: 'monthly subscription',
        },
        {
          '@type': 'Offer',
          name: 'Business',
          price: MEKLOC_PLANS.business.monthlyPrice,
          priceCurrency: 'MAD',
          category: 'monthly subscription',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: MEKLOC_PLANS.pro.monthlyPrice,
          priceCurrency: 'MAD',
          category: 'monthly subscription',
        },
      ],
    },
  ];
}

export function faqStructuredData(faqs: Array<[string, string]>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = '/',
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(canonical);
    const imageUrl = absoluteUrl(image);
    document.documentElement.lang = 'fr';
    document.title = title;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[name="keywords"]', 'name', 'keywords', keywords.join(', '));
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[name="theme-color"]', 'name', 'theme-color', '#050606');
    const googleVerification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
    if (googleVerification) {
      setMeta('meta[name="google-site-verification"]', 'name', 'google-site-verification', googleVerification);
    }

    setLink('canonical', canonicalUrl);

    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);

    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);

    const existing = document.getElementById('mekloc-jsonld');
    existing?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'mekloc-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [canonical, description, image, jsonLd, keywords, noindex, title]);

  return null;
}
