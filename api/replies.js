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
  console.log(`[${method}] /api/replies - Body:`, request.body);
  
  try {
    if (method === 'GET') {
      const replies = await kv.lrange('replies', 0, -1);
      console.log(`Retrieved ${replies.length} replies`);
      // HTML側では文字列として扱われることを想定
      return response.status(200).json(replies);
      
    } else if (method === 'POST') {
      let body;
      if (typeof request.body === 'string') {
        body = JSON.parse(request.body);
      } else {
        body = request.body;
      }
      
      const { threadId, content, user } = body;
      console.log('Parsed body:', { threadId, content, user });
      
      if (!threadId || !content) {
        return response.status(400).json({ error: 'スレッドIDと内容は必須です' });
      }
      
      const newReply = { 
        id: Date.now().toString(), 
        threadId, 
        content, 
        user: user || '名無し', 
        timestamp: Date.now() 
      };
      
      console.log('Creating reply:', newReply);
      
      await kv.lpush('replies', JSON.stringify(newReply));
      console.log('Reply saved successfully');
      
      return response.status(200).json(newReply);
      
    } else if (method === 'DELETE') {
      let body;
      if (typeof request.body === 'string') {
        body = JSON.parse(request.body);
      } else {
        body = request.body;
      }
      
      const { replyId } = body;
      console.log('Deleting reply:', replyId);
      
      if (replyId === 'all') {
        await kv.del('replies');
        return response.status(200).json({ message: '全返信を削除しました' });
      }
      
      let replies = await kv.lrange('replies', 0, -1);
      replies = replies.filter(reply => JSON.parse(reply).id !== replyId);
      await kv.del('replies');
      for (const reply of replies) {
        await kv.rpush('replies', reply);
      }
      return response.status(200).json({ message: '返信を削除しました' });
      
    } else {
      response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return response.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Replies API Error:', error);
    return response.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: error.message 
    });
  }
}
