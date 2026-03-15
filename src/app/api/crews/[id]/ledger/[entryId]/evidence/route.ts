import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/crews/[id]/ledger/[entryId]/evidence — 증빙 signed URL 목록 반환
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: entry } = await supabase
      .from('ledger_entries')
      .select('evidence_urls')
      .eq('id', entryId)
      .eq('crew_id', id)
      .single();

    if (!entry) return NextResponse.json({ error: '장부를 찾을 수 없습니다.' }, { status: 404 });

    const filePaths: string[] = entry.evidence_urls || [];
    if (filePaths.length === 0) return NextResponse.json({ signedUrls: [] });

    const { data: signedData, error: signedError } = await supabase.storage
      .from('ledger-evidence')
      .createSignedUrls(filePaths, 3600);

    if (signedError) throw signedError;

    const signedUrls = (signedData || []).map(item => item.signedUrl);
    return NextResponse.json({ signedUrls });

  } catch (error: unknown) {
    console.error('Evidence signed URL error:', error);
    return NextResponse.json({ error: '증빙 URL 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if entry exists and is not locked
    const { data: entry } = await supabase
      .from('ledger_entries')
      .select('is_locked, evidence_urls, created_by')
      .eq('id', entryId)
      .eq('crew_id', id)
      .single();

    if (!entry) return NextResponse.json({ error: '장부를 찾을 수 없습니다.' }, { status: 404 });
    if (entry.is_locked) return NextResponse.json({ error: '확정된 장부에는 증빙을 추가할 수 없습니다.' }, { status: 400 });
    if (entry.created_by !== user.id) return NextResponse.json({ error: '장부 작성자만 증빙을 추가할 수 있습니다.' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    // Validate file type (MIME + extension whitelist)
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];
    const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: '허용되지 않는 파일 형식입니다. (jpg, png, gif, webp, mp4, webm, mov만 가능)' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '허용되지 않는 파일 형식입니다.' }, { status: 400 });
    }

    // Validate size: 50MB for video, 5MB for image
    const isVideo = VIDEO_EXTENSIONS.includes(fileExt);
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: isVideo ? '동영상 파일 크기는 50MB 이하여야 합니다.' : '이미지 파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const fileName = `${id}/${entryId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ledger-evidence')
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      throw uploadError;
    }

    // Get signed URL (1시간 유효) - public URL 대신 signed URL 사용
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('ledger-evidence')
      .createSignedUrl(fileName, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: '파일 URL 생성에 실패했습니다.' }, { status: 500 });
    }

    const fileUrl = signedUrlData.signedUrl;

    // Update entry with new evidence URL array (store file path for re-signing)
    const updatedUrls = [...(entry.evidence_urls || []), fileName];
    const updatePayload: Record<string, unknown> = { evidence_urls: updatedUrls };
    if (isVideo) {
      updatePayload.has_video_evidence = true;
    }

    const { error: updateError } = await supabase
      .from('ledger_entries')
      .update(updatePayload)
      .eq('id', entryId);

    if (updateError) {
      // Try to clean up uploaded file if DB update fails
      await supabase.storage.from('ledger-evidence').remove([fileName]);
      throw updateError;
    }

    return NextResponse.json({ success: true, url: fileUrl, filePath: fileName });

  } catch (error: unknown) {
    console.error('Evidence upload error:', error);
    return NextResponse.json({ error: '증빙 자료 업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
