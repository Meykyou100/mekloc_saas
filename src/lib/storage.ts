import { storageBuckets, supabase } from './supabase';
import { safeStoragePath, validateFileUpload } from './security';

function toErrorMessage(error: unknown) {
  if (!error) return 'Erreur inconnue';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return JSON.stringify(error);
}

export async function uploadAgencyLogo(agencyId: string, file: File) {
  if (!supabase) return null;
  const validation = validateFileUpload(file, {
    maxSizeMb: 3,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  });
  if (validation) throw new Error(validation);

  const path = safeStoragePath(agencyId, 'logos', file.name || 'logo.png');
  const uploadBuckets: string[] = [storageBuckets.logos, storageBuckets.agencyAssets];
  let uploadData: { path: string } | null = null;
  let usedBucket = storageBuckets.logos as string;
  let lastErrorMessage = '';

  for (const bucket of uploadBuckets) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (!error && data) {
      uploadData = data;
      usedBucket = bucket;
      break;
    }
    lastErrorMessage = error ? toErrorMessage(error) : '';
  }

  if (!uploadData) {
    const message = lastErrorMessage || '';
    if (/bucket not found|not found/i.test(message)) {
      throw new Error('Bucket logo introuvable. Créez "logos" ou "agency-assets" dans Supabase Storage.');
    }
    if (/row-level security|policy|permission denied|not authorized/i.test(message)) {
      throw new Error('Permission refusée pour le bucket logos. Vérifiez les policies Storage.');
    }
    throw new Error(`Upload logo impossible: ${message || 'Erreur inconnue'}`);
  }

  const signed = await supabase.storage.from(usedBucket).createSignedUrl(uploadData.path, 60 * 60);
  const resolvedLogoUrl = signed.data?.signedUrl || null;
  let { data: savedLogo, error: saveError } = await supabase
    .from('agencies')
    .update({ logo_path: uploadData.path, logo_url: resolvedLogoUrl })
    .eq('id', agencyId)
    .select('logo_path')
    .maybeSingle();
  if (saveError && /logo_url|schema cache|does not exist/i.test(saveError.message || '')) {
    const fallback = await supabase
      .from('agencies')
      .update({ logo_path: uploadData.path })
      .eq('id', agencyId)
      .select('logo_path')
      .maybeSingle();
    savedLogo = fallback.data;
    saveError = fallback.error;
  }
  if (saveError) {
    throw new Error(`Sauvegarde logo impossible: ${toErrorMessage(saveError)}`);
  }
  if (!savedLogo || savedLogo.logo_path !== uploadData.path) {
    throw new Error("Le logo a été envoyé mais son chemin n'a pas été enregistré pour cette agence.");
  }
  return { path: uploadData.path, bucket: usedBucket };
}

export async function uploadAgencyStamp(agencyId: string, file: File) {
  if (!supabase) return null;
  const validation = validateFileUpload(file, {
    maxSizeMb: 3,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  });
  if (validation) throw new Error(validation);

  const path = safeStoragePath(agencyId, 'stamps', file.name || 'cachet-agence.png');
  const { data, error } = await supabase.storage.from(storageBuckets.agencyAssets).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error || !data) {
    const message = error ? toErrorMessage(error) : 'Erreur inconnue';
    if (/bucket not found|not found/i.test(message)) {
      throw new Error('Bucket "agency-assets" introuvable dans Supabase Storage.');
    }
    if (/row-level security|policy|permission denied|not authorized/i.test(message)) {
      throw new Error('Permission refusée pour enregistrer le cachet de cette agence.');
    }
    throw new Error(`Upload cachet impossible: ${message}`);
  }

  return { path: data.path, bucket: storageBuckets.agencyAssets };
}

export async function uploadBlogCover(file: File) {
  if (!supabase) return null;
  const validation = validateFileUpload(file, {
    maxSizeMb: 5,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  });
  if (validation) throw new Error(validation);

  const path = safeStoragePath('blog', 'covers', file.name || 'cover.png');
  const { data, error } = await supabase.storage.from(storageBuckets.blogCovers).upload(path, file, {
    cacheControl: '31536000',
    upsert: true,
  });

  if (error || !data) {
    const message = error ? toErrorMessage(error) : 'Erreur inconnue';
    if (/bucket not found|not found/i.test(message)) {
      throw new Error('Bucket "blog-covers" introuvable. Appliquez la migration blog_posts_safe.sql.');
    }
    if (/row-level security|policy|permission denied|not authorized/i.test(message)) {
      throw new Error('Permission refusée pour envoyer une couverture blog. Vérifiez les policies Storage.');
    }
    throw new Error(`Upload couverture impossible: ${message}`);
  }

  const publicUrl = supabase.storage.from(storageBuckets.blogCovers).getPublicUrl(data.path).data.publicUrl;
  return publicUrl || null;
}

export async function uploadContractPdf(agencyId: string, contractId: string, file: File) {
  if (!supabase) return null;

  const path = safeStoragePath(agencyId, `contracts-${contractId}`, 'contrat.pdf');
  const { data, error } = await supabase.storage.from(storageBuckets.contracts).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'application/pdf',
  });

  if (error) throw new Error(`Upload PDF impossible: ${toErrorMessage(error)}`);

  await supabase.from('contracts').update({ pdf_path: data.path }).eq('id', contractId);
  return data.path;
}
