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
      
      // JSON文字列をパースしてオブジェクト配列として返す
      const parsedThreads = threads.map(thread => JSON.parse(thread));
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
      
      let threads = await kv.lrange('threads', 0, -1);
      threads = threads.filter(thread => JSON.parse(thread).id !== threadId);
      await kv.del('threads');
      for (const thread of threads) {
        await kv.rpush('threads', thread);
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
