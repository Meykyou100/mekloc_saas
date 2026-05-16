import { storageBuckets, supabase } from './supabase';

export async function uploadAgencyLogo(agencyId: string, file: File) {
  if (!supabase) return null;

  const extension = file.name.split('.').pop() || 'png';
  const path = `${agencyId}/logo-${Date.now()}.${extension}`;
  const { data, error } = await supabase.storage.from(storageBuckets.logos).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    const message = error.message || '';
    if (/bucket not found/i.test(message)) {
      throw new Error('Bucket logos introuvable. Créez le bucket "logos" dans Supabase Storage.');
    }
    if (/row-level security|policy/i.test(message)) {
      throw new Error('Permission refusée pour le bucket logos. Vérifiez les policies Storage.');
    }
    throw error;
  }

  const { data: publicData } = supabase.storage.from(storageBuckets.logos).getPublicUrl(data.path);
  const { error: saveError } = await supabase.from('agencies').update({ logo_path: data.path, logo_url: publicData.publicUrl }).eq('id', agencyId);
  if (saveError) throw saveError;
  return data.path;
}

export async function uploadContractPdf(agencyId: string, contractId: string, file: File) {
  if (!supabase) return null;

  const path = `${agencyId}/${contractId}-${Date.now()}.pdf`;
  const { data, error } = await supabase.storage.from(storageBuckets.contracts).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'application/pdf',
  });

  if (error) throw error;

  await supabase.from('contracts').update({ pdf_path: data.path }).eq('id', contractId);
  return data.path;
}
