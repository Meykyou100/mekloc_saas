import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/system/SEO';
import { formatBlogDate, renderMarkdownToHtml, type BlogPost } from '../lib/blog';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import NotFoundPage from './NotFoundPage';

export default function BlogArticlePage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPost() {
      if (!slug || !supabase || !isSupabaseConfigured) {
        setLoading(false);
        setNotFound(true);
        return;
      }
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (!mounted) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setPost(data as BlogPost);
      }
      setLoading(false);
    }
    void loadPost();
    return () => { mounted = false; };
  }, [slug]);

  if (!loading && notFound) return <NotFoundPage />;

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      {post ? (
        <SEO
          title={`${post.title} – Blog MekLoc`}
          description={post.excerpt || 'Article MekLoc pour agences de location automobile au Maroc.'}
          canonical={`/blog/${post.slug}`}
        />
      ) : null}
      <header className="border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[980px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-11 w-auto" />
          </Link>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-black text-white/70 hover:text-[#F5C542]">
            <ArrowLeft className="h-4 w-4" />
            Tous les articles
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14">
        <article className="mx-auto max-w-[820px]">
          {loading || !post ? (
            <p className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-zinc-400">Chargement de l’article...</p>
          ) : (
            <>
              <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-[#F5C542]">
                <ArrowLeft className="h-4 w-4" />
                Tous les articles
              </Link>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-[#F5C542]">{post.category || 'Guide MekLoc'}</p>
              <h1 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">{post.title}</h1>
              {post.excerpt ? <p className="mt-5 text-lg leading-8 text-zinc-400">{post.excerpt}</p> : null}
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold text-zinc-500">
                <span>{post.author_name || 'MekLoc'}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatBlogDate(post.published_at)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{post.reading_time_minutes || 3} min</span>
              </div>

              {post.cover_image_url ? (
                <figure className="mt-9 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.04]">
                  <img src={post.cover_image_url} alt="" className="aspect-[16/9] w-full object-cover" />
                </figure>
              ) : null}

              <div
                className="blog-prose mt-10 text-zinc-300"
                dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.content) }}
              />

              {post.tags.length ? (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-6">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">#{tag}</span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </article>
      </main>
      <style>{`
        .blog-prose h1, .blog-prose h2, .blog-prose h3 { color: white; font-weight: 900; letter-spacing: -0.02em; }
        .blog-prose h1 { font-size: 2rem; margin: 2.2rem 0 1rem; }
        .blog-prose h2 { font-size: 1.55rem; margin: 2rem 0 .8rem; }
        .blog-prose h3 { font-size: 1.2rem; margin: 1.5rem 0 .6rem; }
        .blog-prose p { margin: 1rem 0; line-height: 1.9; color: rgb(212 212 216); }
        .blog-prose ul { margin: 1rem 0; padding-left: 1.2rem; list-style: disc; color: rgb(212 212 216); }
        .blog-prose li { margin: .45rem 0; line-height: 1.8; }
        .blog-prose strong { color: white; font-weight: 900; }
        .blog-prose a { color: #F5C542; text-decoration: underline; text-underline-offset: 4px; }
      `}</style>
    </div>
  );
}
