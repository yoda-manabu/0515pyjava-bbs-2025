import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // CORS対応
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  const method = request.method;
  console.log(`[${method}] /api/threads - Body:`, request.body);
  
  try {
    if (method === 'GET') {
      const threads = await kv.lrange('threads', 0, -1);
      console.log(`Retrieved ${threads.length} threads`);
      
      // データの形式を統一して処理
      const parsedThreads = threads.map(thread => {
        try {
          // 既にオブジェクトの場合はそのまま、文字列の場合はパースする
          return typeof thread === 'string' ? JSON.parse(thread) : thread;
        } catch (error) {
          console.error('Thread parse error:', error, 'Thread data:', thread);
          return null;
        }
      }).filter(thread => thread !== null);
      
      return response.status(200).json(parsedThreads.reverse());
      
    } else if (method === 'POST') {
      // リクエストボディの取得方法を修正
      let body;
      if (typeof request.body === 'string') {
        body = JSON.parse(request.body);
      } else {
        body = request.body;
      }
      
      const { title, content, user } = body;
      console.log('Parsed body:', { title, content, user });
      
      if (!title || !content) {
        console.log('Validation failed: missing title or content');
        return response.status(400).json({ error: 'タイトルと本文は必須です' });
      }
      
      const newThread = { 
        id: Date.now().toString(), 
        title, 
        content, 
        user: user || '名無し', 
        timestamp: Date.now() 
      };
      
      console.log('Creating thread:', newThread);
      
      await kv.lpush('threads', JSON.stringify(newThread));
      console.log('Thread saved successfully');
      
      return response.status(200).json(newThread);
      
    } else if (method === 'DELETE') {
      let body;
      if (typeof request.body === 'string') {
        body = JSON.parse(request.body);
      } else {
        body = request.body;
      }
      
      const { threadId } = body;
      console.log('Deleting thread:', threadId);
      
      if (threadId === 'all') {
        await kv.del('threads');
        return response.status(200).json({ message: '全スレッドを削除しました' });
      }
      
      // 個別削除の場合
      const threads = await kv.lrange('threads', 0, -1);
      const filteredThreads = threads.filter(thread => {
        try {
          const parsed = typeof thread === 'string' ? JSON.parse(thread) : thread;
          return parsed.id !== threadId;
        } catch (error) {
          console.error('Error parsing thread for deletion:', error);
          return false;
        }
      });
      
      // 一度全削除してから再追加
      await kv.del('threads');
      for (const thread of filteredThreads.reverse()) {
        await kv.lpush('threads', typeof thread === 'string' ? thread : JSON.stringify(thread));
      }
      
      return response.status(200).json({ message: 'スレッドを削除しました' });
      
    } else {
      response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return response.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Threads API Error:', error);
    return response.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: error.message 
    });
  }
}
