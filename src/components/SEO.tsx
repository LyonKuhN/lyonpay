import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
}

export default function SEO({
  title = 'Lyonk | Controle Financeiro Pessoal e Gestão de Despesas',
  description = 'A melhor plataforma de controle financeiro pessoal. Automatize contas fixas, acompanhe parcelas, gráficos dinâmicos e alertas de vencimento sem complicação.',
  canonicalUrl = 'https://lyonk.com.br/',
  ogType = 'website',
  ogImage = 'https://lyonk.com.br/og-image.png',
}: SEOProps) {
  useEffect(() => {
    // Document Title
    document.title = title;

    // Meta Description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      metaDescription.setAttribute('content', description);
      document.head.appendChild(metaDescription);
    }

    // Canonical Tag
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (linkCanonical) {
      linkCanonical.setAttribute('href', canonicalUrl);
    } else {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      linkCanonical.setAttribute('href', canonicalUrl);
      document.head.appendChild(linkCanonical);
    }

    // OG Title
    const ogTitleTag = document.querySelector('meta[property="og:title"]');
    if (ogTitleTag) {
      ogTitleTag.setAttribute('content', title);
    }

    // OG Description
    const ogDescTag = document.querySelector('meta[property="og:description"]');
    if (ogDescTag) {
      ogDescTag.setAttribute('content', description);
    }

    // OG URL
    const ogUrlTag = document.querySelector('meta[property="og:url"]');
    if (ogUrlTag) {
      ogUrlTag.setAttribute('content', canonicalUrl);
    }

    // OG Image
    const ogImgTag = document.querySelector('meta[property="og:image"]');
    if (ogImgTag) {
      ogImgTag.setAttribute('content', ogImage);
    }

    // Twitter Title
    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', title);
    }

    // Twitter Description
    const twitterDesc = document.querySelector('meta[property="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.setAttribute('content', description);
    }
  }, [title, description, canonicalUrl, ogType, ogImage]);

  return null;
}
