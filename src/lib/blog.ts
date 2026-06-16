export type BlogPostStatus = 'draft' | 'published';

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  author_name: string;
  status: BlogPostStatus;
  published_at: string | null;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: string;
  tagsText: string;
  author_name: string;
  status: BlogPostStatus;
  published_at: string;
};

export const blogCategories = [
  'Gestion agence',
  'Rentabilité',
  'Contrats',
  'Réservations',
  'Paiements',
  'Flotte',
];

export function slugifyBlogTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function estimateReadingTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function formatBlogDate(value: string | null) {
  if (!value) return 'Brouillon';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderMarkdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }
    if (/^###\s+/.test(trimmed)) {
      closeList();
      html.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`);
      return;
    }
    if (/^##\s+/.test(trimmed)) {
      closeList();
      html.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`);
      return;
    }
    if (/^#\s+/.test(trimmed)) {
      closeList();
      html.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h1>`);
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      return;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  });
  closeList();
  return html.join('\n');
}
