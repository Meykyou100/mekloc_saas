import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/system/SEO';
import Card from '../components/ui/Card';
import { formatBlogDate, type BlogPost } from '../lib/blog';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadPosts() {
      if (!supabase || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (mounted) {
        if (!error) setPosts((data || []) as BlogPost[]);
        setLoading(false);
      }
    }
    void loadPosts();
    return () => { mounted = false; };
  }, []);

  const filteredPosts = posts.filter((post) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${post.title} ${post.excerpt || ''} ${post.category || ''} ${post.tags.join(' ')}`.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#070807] text-white">
      <SEO
        title="Blog MekLoc – Conseils pour agences de location au Maroc"
        description="Guides pratiques pour gérer réservations, flotte, contrats PDF, paiements et rentabilité dans une agence de location automobile au Maroc."
        canonical="/blog"
      />
      <header className="border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-11 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-white/70 sm:flex">
            <Link to="/#fonctionnalites" className="hover:text-[#F5C542]">Produit</Link>
            <Link to="/#tarifs" className="hover:text-[#F5C542]">Tarifs</Link>
            <Link to="/blog" className="text-[#F5C542]">Blog</Link>
            <Link to="/auth" className="hover:text-[#F5C542]">Connexion</Link>
          </nav>
          <Link to="/demande-acces?plan=pro&billing=12-months&trial=7" className="rounded-xl bg-[#E3B117] px-4 py-3 text-sm font-black text-[#070807] transition hover:bg-[#F5C542]">
            Demandez votre accès
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-16 sm:px-6 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(227,177,23,.16),transparent_45%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#F5C542]">Blog MekLoc</p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-6xl">Guides pour mieux gérer votre agence</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
              Conseils terrain, méthodes et bonnes pratiques pour piloter vos réservations, véhicules, contrats et paiements avec plus de clarté.
            </p>
            <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
              <Search className="h-5 w-5 text-[#F5C542]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un article..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[1180px]">
            {loading ? (
              <Card className="p-8 text-center text-zinc-400">Chargement des articles...</Card>
            ) : filteredPosts.length === 0 ? (
              <Card className="p-10 text-center">
                <p className="text-lg font-black text-white">Aucun article publié pour le moment</p>
                <p className="mt-2 text-sm text-zinc-400">Les prochains guides MekLoc apparaîtront ici.</p>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredPosts.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group min-w-0">
                    <article className="h-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-950/75 shadow-[0_24px_70px_rgba(0,0,0,.28)] transition duration-300 hover:-translate-y-1 hover:border-[#E3B117]/35 hover:bg-zinc-900/80">
                      <div className="aspect-[16/10] overflow-hidden bg-white/[0.04]">
                        {post.cover_image_url ? (
                          <img src={post.cover_image_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(227,177,23,.18),transparent_48%),linear-gradient(135deg,#121212,#050505)]">
                            <span className="text-xs font-black uppercase tracking-[0.28em] text-[#F5C542]">MekLoc Guide</span>
                          </div>
                        )}
                      </div>
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatBlogDate(post.published_at)}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{post.reading_time_minutes || 3} min</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black leading-tight text-white group-hover:text-[#F5C542]">{post.title}</h2>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{post.excerpt || 'Guide pratique MekLoc pour agences de location automobile.'}</p>
                        <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#F5C542]">
                          Lire l’article <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
