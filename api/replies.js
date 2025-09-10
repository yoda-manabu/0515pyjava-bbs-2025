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
      
      // データの形式を統一して処理
      const parsedReplies = replies.map(reply => {
        try {
          // 既にオブジェクトの場合はそのまま、文字列の場合はパースする
          return typeof reply === 'string' ? JSON.parse(reply) : reply;
        } catch (error) {
          console.error('Reply parse error:', error, 'Reply data:', reply);
          return null;
        }
      }).filter(reply => reply !== null);
      
      return response.status(200).json(parsedReplies);
      
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
      
      // 個別削除の場合
      const replies = await kv.lrange('replies', 0, -1);
      const filteredReplies = replies.filter(reply => {
        try {
          const parsed = typeof reply === 'string' ? JSON.parse(reply) : reply;
          return parsed.id !== replyId;
        } catch (error) {
          console.error('Error parsing reply for deletion:', error);
          return false;
        }
      });
      
      // 一度全削除してから再追加
      await kv.del('replies');
      for (const reply of filteredReplies.reverse()) {
        await kv.lpush('replies', typeof reply === 'string' ? reply : JSON.stringify(reply));
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
