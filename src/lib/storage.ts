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
  const uploadBuckets: string[] = [storageBuckets.logos, 'agency-assets'];
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
  const { error: saveError } = await supabase
    .from('agencies')
    .update({ logo_path: uploadData.path, logo_url: resolvedLogoUrl })
    .eq('id', agencyId);
  if (saveError) {
    throw new Error(`Sauvegarde logo impossible: ${toErrorMessage(saveError)}`);
  }
  return uploadData.path;
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
