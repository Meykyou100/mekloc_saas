import { storageBuckets, supabase } from './supabase';

export async function uploadAgencyLogo(agencyId: string, file: File) {
  if (!supabase) return null;

  const extension = file.name.split('.').pop() || 'png';
  const path = `${agencyId}/logo-${Date.now()}.${extension}`;
  const { data, error } = await supabase.storage.from(storageBuckets.logos).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) throw error;

  await supabase.from('agencies').update({ logo_path: data.path }).eq('id', agencyId);
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
