import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const method = req.method;
  console.log(`[${method}] /api/threads`);
  
  try {
    if (method === 'GET') {
      console.log('Getting threads from KV...');
      const threads = await kv.lrange('threads', 0, -1) || [];
      console.log(`Retrieved ${threads.length} threads`);
      
      const parsedThreads = threads.map(thread => JSON.parse(thread));
      return res.status(200).json(parsedThreads.reverse());
      
    } else if (method === 'POST') {
      console.log('Creating new thread...');
      const { title, content, user } = req.body;
      console.log('Request body:', { title, content, user });
      
      if (!title || !content) {
        console.log('Validation error: missing title or content');
        return res.status(400).json({ error: 'タイトルと本文は必須です' });
      }
      
      const newThread = { 
        id: Date.now().toString(), 
        title, 
        content, 
        user: user || '名無し', 
        timestamp: Date.now() 
      };
      
      console.log('Saving thread:', newThread);
      await kv.lpush('threads', JSON.stringify(newThread));
      console.log('Thread saved successfully');
      
      return res.status(201).json(newThread);
      
    } else if (method === 'DELETE') {
      console.log('Deleting thread...');
      const { threadId } = req.body;
      console.log('Thread ID to delete:', threadId);
      
      if (threadId === 'all') {
        await kv.del('threads');
        console.log('All threads deleted');
        return res.status(200).json({ message: '全スレッドを削除しました' });
      }
      
      let threads = await kv.lrange('threads', 0, -1) || [];
      const filteredThreads = threads.filter(thread => {
        const parsed = JSON.parse(thread);
        return parsed.id !== threadId;
      });
      
      if (threads.length === filteredThreads.length) {
        return res.status(404).json({ error: 'スレッドが見つかりません' });
      }
      
      await kv.del('threads');
      if (filteredThreads.length > 0) {
        for (const thread of filteredThreads) {
          await kv.rpush('threads', thread);
        }
      }
      
      console.log('Thread deleted successfully');
      return res.status(200).json({ message: 'スレッドを削除しました' });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Threads API Error:', error);
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: error.message 
    });
  }
}
