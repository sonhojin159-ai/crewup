import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// 1. Get chat list or specific chat history
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: crewId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicantId = searchParams.get('applicantId');

    try {
        // 크루장 여부 확인
        const { data: crew } = await supabase
            .from('crews')
            .select('created_by')
            .eq('id', crewId)
            .single();

        if (!crew) {
            return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
        }

        const isLeader = crew.created_by === user.id;

        if (applicantId) {
            // 특정 신청자와의 대화 내역 조회 (크루장 또는 신청자 본인)
            if (!isLeader && applicantId !== user.id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // 1) 채팅방 찾기
            const { data: chat } = await supabase
                .from('crew_chats')
                .select('id')
                .eq('crew_id', crewId)
                .eq('applicant_id', applicantId)
                .maybeSingle();

            if (!chat) {
                return NextResponse.json({ messages: [], chatId: null });
            }

            // 2) 리스트 가져오기
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('*, profiles:sender_id(nickname, avatar_url)')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: true });

            return NextResponse.json({ messages: messages || [], chatId: chat.id });
        } else {
            // 방 목록 조회 (크루장만 전체 목록 조회 가능)
            if (!isLeader) {
                 return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const { data: chats } = await supabase
                .from('crew_chats')
                .select('*, profiles:applicant_id(nickname, avatar_url), chat_messages(content, created_at)')
                .eq('crew_id', crewId)
                .order('updated_at', { ascending: false });
            
            // 각 채팅방의 가장 최근 메시지만 포함하도록 가공
            const processedChats = (chats || []).map((chat: any) => {
                const msgs = chat.chat_messages || [];
                msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const lastMessage = msgs.length > 0 ? msgs[0] : null;
                delete chat.chat_messages;
                return { ...chat, lastMessage };
            });

            return NextResponse.json(processedChats);
        }

    } catch (error: unknown) {
        console.error('Chat GET error:', error);
        return NextResponse.json({ error: '채팅 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

// 2. Send message
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: crewId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { content, targetApplicantId } = body;

        if (!content?.trim()) {
            return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });
        }

        const { data: crew } = await supabase
            .from('crews')
            .select('created_by')
            .eq('id', crewId)
            .single();

        if (!crew) throw new Error('Crew not found');

        const isLeader = crew.created_by === user.id;
        
        // 크루장이 보낼 땐 대상(targetApplicantId) 필수, 일반 유저가 보낼 땐 본인이 대상
        const applicantId = isLeader ? targetApplicantId : user.id;

        if (!applicantId) {
            return NextResponse.json({ error: '대상 신청자 ID가 필요합니다.' }, { status: 400 });
        }

        // 1) Upsert 채팅방 (없으면 만들고 있으면 id 가져옴)
        // RPC나 select 후 insert 로직 사용 (여기선 먼저 찾고 없으면 insert)
        let chatId;
        const { data: existingChat } = await supabase
            .from('crew_chats')
            .select('id')
            .eq('crew_id', crewId)
            .eq('applicant_id', applicantId)
            .maybeSingle();

        if (existingChat) {
            chatId = existingChat.id;
        } else {
            const { data: newChat, error: newChatErr } = await supabase
                .from('crew_chats')
                .insert({ crew_id: crewId, applicant_id: applicantId })
                .select('id')
                .single();
            if (newChatErr) throw newChatErr;
            chatId = newChat.id;
        }

        // 2) 메시지 삽입
        const { data: message, error: messageErr } = await supabase
            .from('chat_messages')
            .insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content.trim()
            })
            .select('*, profiles:sender_id(nickname, avatar_url)')
            .single();

        if (messageErr) throw messageErr;

        // 3) 채팅방 updated_at 갱신
        await supabase
            .from('crew_chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId);

        return NextResponse.json(message, { status: 201 });

    } catch (error: unknown) {
        console.error('Chat POST error:', error);
        return NextResponse.json({ error: '메시지 전송 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
